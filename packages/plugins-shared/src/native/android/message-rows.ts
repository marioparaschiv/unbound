import type {
	NativeJavaBridge,
	NativeJavaHookToken,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIBridge,
} from '@unbound-app/api/native';
import {
	MESSAGE_VIEW,
	messageBindMethod,
	messageIdField,
	messageIdOf,
} from '@unbound-plugins/shared/native/android/discord-views';
import {
	currentDecorView,
	findViewsOfClass,
	scheduleStartupScans,
} from '@unbound-plugins/shared/native/android/views';
import {
	javaReference,
	javaString,
	javaViewKey,
} from '@unbound-plugins/shared/native/android/java-values';
import { RECEIVER_ONLY_AFTER_CALL } from '@unbound-plugins/shared/native/android/hook-options';
import { installRebindGuard } from '@unbound-plugins/shared/native/android/rebind-guard';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';

const SIZE_PARAMETERS = ['int', 'int', 'int', 'int'];

export type MessageRowNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	ui: NativeUIBridge;
};

export type MessageRowDrawing = {
	/** Draws on a row Discord bound to a message. Resolves `false` when the row is not laid out yet, to draw again once its size changes. */
	draw(row: NativeJavaReference, messageId: string): Promise<boolean | void>;
	/** Takes the drawing off a row, once the watcher stops. */
	clear(row: NativeJavaReference): Promise<void>;
};

export type MessageRows = {
	/** Draws again on each row that shows `messageId`, or on every bound row. */
	redraw(messageId?: string): void;
	/** Records the views drawn on a row for a message, which a rebind to another message hides at once on the UI thread. */
	markDrawn(row: NativeJavaReference, messageId: string, views: NativeJavaReference[]): void;
	/** Stops watching, waits for draws in flight, then clears every bound row. */
	dispose(): Promise<void>;
};

type Bound = {
	row: NativeJavaReference;
	messageId: string;
};

/**
 * @description Watches Discord's Android message rows: each bind, each row on screen at startup and each row that resizes while it waits for a size is drawn in turn, one draw per row at a time.
 * @param native The plugin's Java, hook and UI bridges.
 * @param drawing Draws on one row for a message, and clears a row when the watcher stops.
 * @returns `redraw`, `markDrawn` and `dispose`.
 */
export function watchMessageRows(
	native: MessageRowNative,
	drawing: MessageRowDrawing,
): MessageRows {
	const { java, hooks, ui } = native;
	const bound = new Map<string, Bound>();
	const queues = new Map<string, Promise<void>>();
	const awaitingSize = new Map<string, Bound>();
	const hostsKey = java.createAssociationKey();
	const drawnForKey = java.createAssociationKey();
	const bindMessage = messageBindMethod(java);
	const scope = ui.createScope();
	let sizeToken: NativeJavaHookToken | undefined;
	let disposed = false;

	ui.run(installRebindGuard, scope, {
		messageView: MESSAGE_VIEW,
		bindName: bindMessage.name,
		bindParameters: bindMessage.parameters,
		idField: messageIdField(java),
		hosts: hostsKey,
		drawnFor: drawnForKey,
		label: addon.name,
	});

	async function draw(key: string, entry: Bound) {
		if (disposed || bound.get(key)?.messageId !== entry.messageId) return;

		const drawn = await drawing.draw(entry.row, entry.messageId);

		if (drawn === false && !disposed) {
			awaitingSize.set(key, entry);
			watchSizes();
		} else {
			awaitingSize.delete(key);
		}
	}

	function schedule(row: NativeJavaReference, messageId: string) {
		const key = javaViewKey(row as NativeJavaValue);

		if (!key || disposed) return;

		const entry = { row, messageId };

		bound.set(key, entry);

		const next = (queues.get(key) ?? Promise.resolve())
			.then(() => draw(key, entry))
			.catch((error) => {
				if (!isCancellation(error)) {
					logger.error(`Failed to draw on the row of message ${messageId}:`, error);
				}
			})
			.finally(() => {
				if (queues.get(key) === next) {
					queues.delete(key);
				}
			});

		queues.set(key, next);
	}

	function watchSizes() {
		sizeToken ??= hooks.hook(
			MESSAGE_VIEW,
			'onSizeChanged',
			SIZE_PARAMETERS,
			RECEIVER_ONLY_AFTER_CALL,
			({ self }) => {
				const key = javaViewKey(self);
				const pending = key ? awaitingSize.get(key) : undefined;

				if (!key || !pending) return;

				awaitingSize.delete(key);
				schedule(pending.row, pending.messageId);
			},
		);
	}

	const token = hooks.hook(
		MESSAGE_VIEW,
		bindMessage.name,
		bindMessage.parameters,
		RECEIVER_ONLY_AFTER_CALL,
		({ self }) => {
			const row = javaReference(self);
			const messageId = row ? messageIdOf(java, row) : undefined;

			if (row && messageId) {
				setTimeout(() => schedule(row, messageId), 0);
			}
		},
	);

	async function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const row of await findViewsOfClass(java, decor, MESSAGE_VIEW)) {
			const messageId = messageIdOf(java, row);

			if (messageId) {
				schedule(row, messageId);
			}
		}
	}

	const scans = scheduleStartupScans(scanVisible);

	return {
		redraw(messageId) {
			for (const entry of bound.values()) {
				if (messageId === undefined || entry.messageId === messageId) {
					schedule(entry.row, entry.messageId);
				}
			}
		},
		markDrawn(row, messageId, views) {
			if (!views.length) {
				java.setAssociatedObject(row, hostsKey, { type: 'null' });

				return;
			}

			const list = java.construct('java.util.ArrayList', []);

			for (const view of views) java.invoke(list, 'add', [view]);

			java.setAssociatedObject(row, hostsKey, list);
			java.setAssociatedObject(row, drawnForKey, javaString(messageId));
		},
		async dispose() {
			disposed = true;

			for (const scan of scans) clearTimeout(scan);

			scope.dispose();
			hooks.remove(token);

			if (sizeToken) {
				hooks.remove(sizeToken);
			}

			awaitingSize.clear();
			await Promise.all(queues.values());

			const rows = [...bound.values()].map((entry) => entry.row);

			bound.clear();
			await Promise.all(
				rows.map((row) =>
					drawing.clear(row).catch((error) => {
						if (!isCancellation(error)) {
							logger.error(`Failed to clear a message row:`, error);
						}
					}),
				),
			);
		},
	};
}

export default { watchMessageRows };
