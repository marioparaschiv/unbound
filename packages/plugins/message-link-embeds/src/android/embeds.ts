import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	MESSAGE_VIEW,
	messageBindMethod,
	messageIdField,
} from '@unbound-plugins/shared/native/android/discord-views';
import {
	createHost,
	hostContainer,
	layoutHostingList,
	hostHasContent,
	placeHost,
	removeHost,
	reservedPosition,
	spacerSpan,
} from '@unbound-plugins/shared/native/android/inline-hosts';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import { readViewText } from '@unbound-plugins/shared/native/android/spans';
import {
	currentDecorView,
	findViewsOfClass,
	scheduleStartupScans,
} from '@unbound-plugins/shared/native/android/views';

import { registerMessageSurface, type SurfaceContent } from '~/components/message-surface';
import { findRenderedLinkRange, linkedTargets, targetKey, type LinkTarget } from '~/link-targets';
import { MessageStore, type Message, type Renderers } from '~/modules';
import { buildEmbeddedContent } from '~/embedded-content';
import { createLinkedMessages } from '~/linked-messages';
import { currentChannelId, linkedChannelName } from '~/channels';
import { Surface } from '~/constants';

const MESSAGE_CONTENT_VIEW = 'com.discord.chat.presentation.message.view.MessageContentView';
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const PLACEHOLDER = '￼';
const SETTLE_DELAYS = [0, 120, 600];
const SIZE_PARAMETERS = ['int', 'int', 'int', 'int'];

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

type WaitingView = {
	messageView: NativeJavaReference;
	messageId: string;
};

type Embed = SurfaceContent & {
	id: string;
	messageView: NativeJavaReference;
	textView: NativeJavaReference;
	host: NativeJavaHandle;
	mounting: Promise<NativeFabricSurface> | null;
	messageId: string;
	target: LinkTarget;
	channelName: string;
	density: number;
	height: number;
	placeholder: number;
	renderedText: string | null;
	original: NativeJavaReference | null;
	revision: number;
	disposed: boolean;
};

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

/**
 * @description Embeds the message each Android message links to as a real chat row, the way the iOS client shows it.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param renderers Discord's message renderers, shared with the iOS embeds.
 * @returns `dispose`, which removes the hook and every embed and resolves once the views are restored, or `undefined` when the surface did not register.
 */
export function createAndroidEmbeds({ java, hooks, fabric }: Native, renderers: Renderers) {
	const embeds = new Map<string, Embed>();
	const byId = new Map<string, Embed>();
	const waiting = new Map<string, Map<string, WaitingView>>();
	const awaitingSize = new Map<string, WaitingView>();
	const controller = new AbortController();
	let nextId = 0;

	const linked = createLinkedMessages(controller.signal, (key) => {
		for (const { messageView, messageId } of waiting.get(key)?.values() ?? []) {
			render(messageView, messageId).catch((error) => {
				console.error(
					'[Message Link Embeds] Failed to embed a linked message on Android:',
					error,
				);
			});
		}

		waiting.delete(key);
	});

	const listeners = new Map<string, Set<() => void>>();
	const surfaceModule = registerMessageSurface({
		renderers,
		surface: (surfaceId) => byId.get(surfaceId),
		reportLayout: (surfaceId, height) => reportLayout(surfaceId, height),
		revision: (surfaceId) => byId.get(surfaceId)?.revision ?? -1,
		subscribe(surfaceId, listener) {
			const set = listeners.get(surfaceId) ?? new Set();

			set.add(listener);
			listeners.set(surfaceId, set);

			return () => {
				set.delete(listener);

				if (!set.size) listeners.delete(surfaceId);
			};
		},
	});

	function publish(embed: Embed) {
		embed.revision++;

		for (const listener of listeners.get(embed.id) ?? []) listener();
	}

	if (!surfaceModule) return undefined;

	function contentTextView(
		messageView: NativeJavaReference,
		channelName: string,
	): NativeJavaReference | null {
		const stack: NativeJavaReference[] = [messageView];
		const contentClass = java.getClass(MESSAGE_CONTENT_VIEW);
		const groupClass = java.getClass('android.view.ViewGroup');

		while (stack.length) {
			const view = stack.pop()!;

			if (javaFlag(java.invoke(contentClass, 'isInstance', [view]))) {
				const text = readViewText(java, view)?.string ?? '';

				if (findRenderedLinkRange(text, channelName)) return view;

				continue;
			}

			if (!javaFlag(java.invoke(groupClass, 'isInstance', [view]))) continue;

			const count = javaNumber(java.invoke(view, 'getChildCount', [])) ?? 0;

			for (let index = count - 1; index >= 0; index--) {
				const child = javaReference(java.invoke(view, 'getChildAt', [javaInt(index)]));

				if (child) stack.push(child);
			}
		}

		return null;
	}

	async function teardown(embed: Embed) {
		embed.disposed = true;
		embeds.delete(viewKey(embed.messageView as NativeJavaValue) ?? '');
		byId.delete(embed.id);

		const mounted = await embed.mounting?.catch(() => null);

		if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);

		await removeHost(java, embed.host).catch(() => undefined);
	}

	async function restore(embed: Embed) {
		const current = readViewText(java, embed.textView);

		if (embed.original && current?.string === embed.renderedText) {
			await java.invokeAsync(embed.textView, 'setText', [embed.original]);
			await relayout(embed);
		}
	}

	async function relayout(embed: Embed) {
		await java.invokeAsync(embed.textView, 'requestLayout', []);
		await layoutHostingList(java, embed.messageView);
	}

	async function reserve(embed: Embed): Promise<boolean> {
		const content = readViewText(java, embed.textView);

		if (!content) return false;

		const range = findRenderedLinkRange(content.string, embed.channelName);

		if (!range) return false;

		if (content.string !== embed.renderedText) embed.original = content.text;

		const insertAt = range.location + range.length;
		const builder = java.construct('android.text.SpannableStringBuilder', [content.text]);
		const width = embed.width * embed.density;

		const reserved = content.string.slice(insertAt, insertAt + 2) === `\n${PLACEHOLDER}`;

		java.invoke(builder, 'replace', [
			javaInt(insertAt),
			javaInt(reserved ? insertAt + 2 : insertAt),
			javaString(`\n${PLACEHOLDER}`),
		]);
		java.invoke(builder, 'setSpan', [
			spacerSpan(java, width, (embed.height + Surface.topGap) * embed.density),
			javaInt(insertAt + 1),
			javaInt(insertAt + 2),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);
		embed.placeholder = insertAt + 1;
		embed.renderedText = javaText(java.invoke(builder, 'toString', [])) ?? null;
		await java.invokeAsync(embed.textView, 'setText', [builder]);
		await relayout(embed);

		return true;
	}

	function isCurrent(embed: Embed): boolean {
		return (
			!embed.disposed &&
			embeds.get(viewKey(embed.messageView as NativeJavaValue) ?? '') === embed &&
			readViewText(java, embed.textView)?.string === embed.renderedText
		);
	}

	async function place(embed: Embed) {
		if (!isCurrent(embed)) return;

		const container = hostContainer(java, embed.textView);
		const position = reservedPosition(
			java,
			embed.textView,
			embed.placeholder,
			embed.height * embed.density,
		);

		if (!container || !position) return;

		await placeHost(
			java,
			embed.host,
			container.container,
			{ x: container.offset.x + position.x, y: container.offset.y + position.y },
			{ width: embed.width * embed.density, height: embed.height * embed.density },
		);

		if (!isCurrent(embed)) {
			if (
				embed.disposed ||
				embeds.get(viewKey(embed.messageView as NativeJavaValue) ?? '') !== embed
			) {
				await removeHost(java, embed.host).catch(() => undefined);
			}

			return;
		}

		if (embed.mounting && !embed.disposed) {
			const mounted = await embed.mounting.catch(() => null);

			if (!hostHasContent(java, embed.host)) {
				embed.mounting = null;

				if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);
			}
		}

		if (!embed.mounting && !embed.disposed) {
			embed.mounting = fabric.mountAsync(embed.host, surfaceModule!, {
				renderRevision: embed.revision,
				surfaceId: embed.id,
			});
			await embed.mounting.catch((error: unknown) => {
				embed.mounting = null;
				throw error;
			});
		}
	}

	function settle(embed: Embed) {
		for (const delay of SETTLE_DELAYS) {
			setTimeout(() => {
				place(embed).catch((error) => {
					console.error('[Message Link Embeds] Failed to place an Android embed:', error);
				});
			}, delay);
		}
	}

	function reportLayout(surfaceId: string, height: number) {
		const embed = byId.get(surfaceId);

		if (
			!embed ||
			embed.disposed ||
			!Number.isFinite(height) ||
			height <= 0 ||
			height > Surface.maxHeight
		)
			return;

		const fitted = Math.max(Surface.minHeight, height - Surface.bottomTrim);

		if (Math.abs(fitted - embed.height) < 2) return;

		embed.height = fitted;
		void reserve(embed)
			.then((reserved) => reserved && settle(embed))
			.catch(() => undefined);
	}

	async function render(messageView: NativeJavaReference, messageId: string) {
		const key = viewKey(messageView as NativeJavaValue);

		if (!key) return;

		const channelId = currentChannelId();
		const source: Message | undefined = channelId
			? MessageStore.getMessage(channelId, messageId)
			: undefined;
		const [target] = source ? linkedTargets(source) : [];
		const existing = embeds.get(key);

		if (
			existing &&
			(!target ||
				existing.messageId !== messageId ||
				targetKey(existing.target) !== targetKey(target))
		) {
			await teardown(existing);
		}

		if (!target) {
			awaitingSize.delete(key);

			return;
		}

		const linkedMessage = linked.get(target);

		if (!linkedMessage) {
			const views = waiting.get(targetKey(target)) ?? new Map<string, WaitingView>();

			views.set(key, { messageView, messageId });
			waiting.set(targetKey(target), views);
			linked.fetch(target);

			return;
		}

		const channelName = linkedChannelName(target, linkedMessage);
		const textView = channelName ? contentTextView(messageView, channelName) : null;
		const built = buildEmbeddedContent(renderers, linkedMessage, target.channelId);

		if (!channelName || !textView || !built) {
			if (channelName && built) awaitingSize.set(key, { messageView, messageId });

			return;
		}

		awaitingSize.delete(key);

		const resources = javaReference(java.invoke(textView, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;
		const density = metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
		const textWidth =
			(javaNumber(java.invoke(textView, 'getWidth', [])) ?? 0) -
			(javaNumber(java.invoke(textView, 'getTotalPaddingLeft', [])) ?? 0) -
			(javaNumber(java.invoke(textView, 'getTotalPaddingRight', [])) ?? 0);
		const width = textWidth / density;

		if (width < Surface.minWidth) {
			awaitingSize.set(key, { messageView, messageId });

			return;
		}

		const embed: Embed =
			existing && !existing.disposed
				? Object.assign(existing, {
						textView,
						record: built.record,
						generator: built.generator,
						width,
					})
				: {
						id: `message-link-android-${nextId++}`,
						messageView,
						textView,
						host: createHost(java, textView),
						mounting: null,
						messageId,
						target,
						channelName,
						density,
						height: Surface.minHeight,
						placeholder: 0,
						renderedText: null,
						original: null,
						revision: 0,
						disposed: false,
						...built,
						width,
					};

		embeds.set(key, embed);
		byId.set(embed.id, embed);

		if (embed === existing) publish(embed);

		if (await reserve(embed)) settle(embed);
	}

	const bindMessage = messageBindMethod(java);
	const token = hooks.hook(
		MESSAGE_VIEW,
		bindMessage.name,
		bindMessage.parameters,
		{ notify: true },
		({ self, args }) => {
			const messageView = javaReference(self);
			const message = javaReference(args[0]);
			const messageId = message
				? javaText(java.invoke(message, 'getId-3Eiw7ao', []))
				: undefined;

			if (!messageView || !messageId) return;

			setTimeout(() => {
				render(messageView, messageId).catch((error) => {
					console.error(
						'[Message Link Embeds] Failed to embed a linked message on Android:',
						error,
					);
				});
			}, 0);
		},
	);

	const sizeToken = hooks.hook(
		MESSAGE_VIEW,
		'onSizeChanged',
		SIZE_PARAMETERS,
		{ notify: true },
		({ self }) => {
			const key = viewKey(self);
			const pending = key ? awaitingSize.get(key) : undefined;

			if (!key || !pending) return;

			awaitingSize.delete(key);
			render(pending.messageView, pending.messageId).catch((error) => {
				console.error(
					'[Message Link Embeds] Failed to embed a linked message on Android:',
					error,
				);
			});
		},
	);

	async function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || controller.signal.aborted) return;

		for (const messageView of await findViewsOfClass(java, decor, MESSAGE_VIEW)) {
			const messageId = javaText(java.getField(messageView, messageIdField(java)));

			if (messageId) {
				render(messageView, messageId).catch((error) => {
					console.error(
						'[Message Link Embeds] Failed to embed a linked message on Android:',
						error,
					);
				});
			}
		}
	}

	const scans = scheduleStartupScans('Message Link Embeds', scanVisible);

	return {
		drawn: () => embeds.size,
		dispose() {
			for (const scan of scans) clearTimeout(scan);

			controller.abort();
			hooks.remove(token);
			hooks.remove(sizeToken);
			awaitingSize.clear();
			linked.clear();
			listeners.clear();

			return Promise.all(
				[...embeds.values()].flatMap((embed) => [teardown(embed), restore(embed)]),
			).then(() => undefined);
		},
	};
}

export default { createAndroidEmbeds };
