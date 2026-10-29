import type {
	NativeFabricBridge,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import { createInlineSurfaces } from '@unbound-plugins/shared/native/android/inline-surfaces';
import {
	MESSAGE_VIEW,
	messageBindMethod,
	messageIdField,
} from '@unbound-plugins/shared/native/android/discord-views';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import { readViewTextAsync, type ViewText } from '@unbound-plugins/shared/native/android/spans';
import { connectTextRewrites } from '@unbound-plugins/shared/native/android/text-rewrites';
import { createRewriteRetry } from '@unbound-plugins/shared/native/android/rewrite-retry';
import {
	currentDecorView,
	findViewsOfClass,
	readCalls,
	runOnMain,
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
const SIZE_PARAMETERS = ['int', 'int', 'int', 'int'];
const PLACEHOLDER = '￼';
const INSERTION = `\n${PLACEHOLDER}`;

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

type Embed = SurfaceContent & {
	surfaceId: string;
	target: LinkTarget;
	original: string;
	rendered: string;
	insertAt: number;
	textView: NativeJavaReference;
	density: number;
	revision: number;
};

type WaitingView = {
	messageView: NativeJavaReference;
	messageId: string;
};

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

/**
 * @description Embeds the message each Android message links to as a real chat row through the loader's native text rewrites, so embeds stay in place while the chat scrolls.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param renderers Discord's message renderers, shared with the iOS embeds.
 * @returns `dispose`, which removes every embed and restores the text, or `undefined` when the surface or the native rewrites are unavailable.
 */
export function createNativeEmbeds(native: Native, renderers: Renderers) {
	const { java, hooks } = native;

	if (!connectTextRewrites(java, MESSAGE_CONTENT_VIEW)) return undefined;

	const embeds = new Map<string, Embed>();
	const retries = createRewriteRetry();
	const bySurface = new Map<string, Embed>();
	const heights = new Map<string, number>();
	const listeners = new Map<string, Set<() => void>>();
	const waiting = new Map<string, Map<string, WaitingView>>();
	const awaitingSize = new Map<string, WaitingView>();
	const controller = new AbortController();
	let nextSurface = 0;
	let disposed = false;

	const linked = createLinkedMessages(controller.signal, (key) => {
		for (const { messageView, messageId } of waiting.get(key)?.values() ?? []) {
			schedule(messageView, messageId);
		}

		waiting.delete(key);
	});

	const surfaceModule = registerMessageSurface({
		renderers,
		surface: (surfaceId) => bySurface.get(surfaceId),
		reportLayout: (surfaceId, height) => reportLayout(surfaceId, height),
		revision: (surfaceId) => bySurface.get(surfaceId)?.revision ?? -1,
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

	if (!surfaceModule) return undefined;

	const surfaces = createInlineSurfaces(native, {
		watchedClass: MESSAGE_CONTENT_VIEW,
		surfaceModule,
		groupPrefix: 'embed',
	});

	if (!surfaces) return undefined;

	const inline = surfaces;

	function publish(embed: Embed) {
		embed.revision++;

		for (const listener of listeners.get(embed.surfaceId) ?? []) listener();
	}

	function heightFor(target: LinkTarget): number {
		return heights.get(targetKey(target)) ?? Surface.minHeight;
	}

	function define(embed: Embed): boolean {
		const px = (value: number) => Math.round(value * embed.density);
		const height = heightFor(embed.target);

		return inline.define({
			original: embed.original,
			rendered: embed.rendered,
			textView: embed.textView,
			edits: [
				{
					start: embed.insertAt,
					end: embed.insertAt,
					text: INSERTION,
					spacerOffset: 1,
					width: px(embed.width),
					height: px(height + Surface.topGap),
				},
			],
			slots: [
				{
					surfaceId: embed.surfaceId,
					placeholder: embed.insertAt + 1,
					width: px(embed.width),
					height: px(height),
				},
			],
		});
	}

	function reportLayout(surfaceId: string, height: number) {
		const embed = bySurface.get(surfaceId);

		if (
			!embed ||
			disposed ||
			!Number.isFinite(height) ||
			height <= 0 ||
			height > Surface.maxHeight
		) {
			return;
		}

		const fitted = Math.max(Surface.minHeight, height - Surface.bottomTrim);
		const key = targetKey(embed.target);

		if (Math.abs(fitted - (heights.get(key) ?? Surface.minHeight)) < 2) return;

		heights.set(key, fitted);
		define(embed);
	}

	async function contentTextView(
		messageView: NativeJavaReference,
		channelName: string,
	): Promise<{ view: NativeJavaReference; text: ViewText } | null> {
		const views = await java.findViews!(messageView, MESSAGE_CONTENT_VIEW, {
			maxDepth: 64,
			maxVisited: 2_000,
			maxResults: 32,
			stopAtMatch: true,
		});

		for (const value of views) {
			const view = javaReference(value);
			const text = view ? await readViewTextAsync(java, view) : null;

			if (view && text && findRenderedLinkRange(text.string, channelName))
				return { view, text };
		}

		return null;
	}

	async function textWidth(textView: NativeJavaReference, density: number): Promise<number> {
		const [width, left, right] = (
			await runOnMain(
				java,
				readCalls(textView, ['getWidth', 'getTotalPaddingLeft', 'getTotalPaddingRight']),
			)
		).map((value) => javaNumber(value) ?? 0) as [number, number, number];

		return (width - left - right) / density;
	}

	async function displayDensity(textView: NativeJavaReference): Promise<number> {
		const resources = javaReference(await java.invokeAsync(textView, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
	}

	async function render(messageView: NativeJavaReference, messageId: string) {
		const key = viewKey(messageView as NativeJavaValue);
		const channelId = currentChannelId();
		const source: Message | undefined = channelId
			? MessageStore.getMessage(channelId, messageId)
			: undefined;
		const [target] = source ? linkedTargets(source) : [];

		if (!key || !target || disposed) return;

		const linkedMessage = linked.get(target);

		if (!linkedMessage) {
			const views = waiting.get(targetKey(target)) ?? new Map<string, WaitingView>();

			views.set(key, { messageView, messageId });
			waiting.set(targetKey(target), views);
			linked.fetch(target);

			return;
		}

		const channelName = linkedChannelName(target, linkedMessage);
		const found = channelName ? await contentTextView(messageView, channelName) : null;
		const textView = found?.view;
		const content = found?.text;

		if (disposed || !channelName || !textView || !content || inline.isDefined(content.string)) {
			return;
		}

		const range = findRenderedLinkRange(content.string, channelName);
		const built = buildEmbeddedContent(renderers, linkedMessage, target.channelId);
		const density = await displayDensity(textView);
		const width = await textWidth(textView, density);

		if (!range || !built) return;

		if (width < Surface.minWidth) {
			awaitingSize.set(key, { messageView, messageId });

			return;
		}

		awaitingSize.delete(key);

		const insertAt = range.location + range.length;
		const rendered =
			content.string.slice(0, insertAt) + INSERTION + content.string.slice(insertAt);
		const previous = embeds.get(rendered);
		const embed: Embed = {
			...built,
			width,
			target,
			original: content.string,
			rendered,
			insertAt,
			textView,
			density,
			surfaceId: previous?.surfaceId ?? `message-link-android-${nextSurface++}`,
			revision: previous?.revision ?? 0,
		};

		embeds.set(rendered, embed);
		bySurface.set(embed.surfaceId, embed);
		publish(embed);

		if (define(embed)) {
			retries.succeeded(key);
		} else {
			retries.retry(key, () => schedule(messageView, messageId));
		}
	}

	function schedule(messageView: NativeJavaReference, messageId: string) {
		setTimeout(() => {
			render(messageView, messageId).catch((error) => {
				console.error(
					'[Message Link Embeds] Failed to embed a linked message on Android:',
					error,
				);
			});
		}, 0);
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

			if (messageView && messageId) schedule(messageView, messageId);
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
			schedule(pending.messageView, pending.messageId);
		},
	);

	async function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const messageView of await findViewsOfClass(java, decor, MESSAGE_VIEW)) {
			const messageId = javaText(java.getField(messageView, messageIdField(java)));

			if (messageId) schedule(messageView, messageId);
		}
	}

	const scans = scheduleStartupScans('Message Link Embeds', scanVisible);

	return {
		drawn: () => embeds.size,
		dispose() {
			for (const scan of scans) clearTimeout(scan);

			disposed = true;
			retries.clear();
			controller.abort();
			hooks.remove(token);
			hooks.remove(sizeToken);
			awaitingSize.clear();
			waiting.clear();
			embeds.clear();
			bySurface.clear();
			listeners.clear();

			return inline.dispose();
		},
	};
}

export default { createNativeEmbeds };
