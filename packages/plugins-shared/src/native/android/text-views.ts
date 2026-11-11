import {
	DRAWEE_TEXT_SETTER,
	DRAWEE_TEXT_VIEW,
	draweeTextBuilder,
} from '@unbound-plugins/shared/native/android/discord-views';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	currentDecorView,
	findViewsOfClass,
	scheduleStartupScans,
} from '@unbound-plugins/shared/native/android/views';
import {
	javaFlag,
	javaReference,
	javaViewKey,
} from '@unbound-plugins/shared/native/android/java-values';
import { RECEIVER_ONLY_AFTER_CALL } from '@unbound-plugins/shared/native/android/hook-options';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';

export type TextViewNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
};

export type TextViewWatch = {
	/** The text view class to draw on: Discord's drawee text view, or a subclass such as its message content view. */
	className: string;
	/** Draws on a text view whose text Discord just set. */
	draw(view: NativeJavaReference): Promise<void>;
};

export type TextViews = {
	/** Draws on a view again, once the current draws settle; a view already waiting is drawn once. */
	schedule(view: NativeJavaReference): void;
	/** Whether a draw is waiting or running. */
	busy(): boolean;
	/** Stops watching; draws in flight still finish. */
	dispose(): void;
};

/**
 * @description Watches the Android text views Discord sets rich text on: each text set and each view on screen at startup is drawn, one waiting draw per view.
 * @param native The plugin's Java and hook bridges.
 * @param watch The text view class and the draw.
 * @returns `schedule`, `busy` and `dispose`.
 */
export function watchTextViews(native: TextViewNative, watch: TextViewWatch): TextViews {
	const { java, hooks } = native;
	const pending = new Set<string>();
	const viewClass = java.getClass(watch.className);
	let drawing = 0;
	let disposed = false;

	function accepts(view: NativeJavaReference): boolean {
		return (
			watch.className === DRAWEE_TEXT_VIEW ||
			javaFlag(java.invoke(viewClass, 'isInstance', [view]))
		);
	}

	function schedule(view: NativeJavaReference) {
		const key = javaViewKey(view as NativeJavaValue);

		if (disposed || !key || pending.has(key)) return;

		pending.add(key);
		setTimeout(() => {
			pending.delete(key);

			if (disposed || !accepts(view)) return;

			drawing++;
			watch
				.draw(view)
				.catch((error) => {
					if (!isCancellation(error)) {
						logger.error(`Failed to draw on text view ${key}:`, error);
					}
				})
				.finally(() => drawing--);
		}, 0);
	}

	const token = hooks.hook(
		DRAWEE_TEXT_VIEW,
		DRAWEE_TEXT_SETTER,
		[draweeTextBuilder(java)],
		RECEIVER_ONLY_AFTER_CALL,
		({ self }) => {
			const view = javaReference(self);

			if (view) {
				schedule(view);
			}
		},
	);

	async function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const view of await findViewsOfClass(java, decor, watch.className)) schedule(view);
	}

	const scans = scheduleStartupScans(scanVisible);

	return {
		schedule,
		busy: () => pending.size > 0 || drawing > 0,
		dispose() {
			disposed = true;

			for (const scan of scans) clearTimeout(scan);

			hooks.remove(token);
			pending.clear();
		},
	};
}

export default { watchTextViews };
