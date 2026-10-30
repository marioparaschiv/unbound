import { createSurfaceListeners } from '@unbound-plugins/shared/native/surface-listeners';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type {
	NativeFabricBridge,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	DRAWEE_TEXT_SETTER,
	DRAWEE_TEXT_VIEW,
	draweeTextBuilder,
} from '@unbound-plugins/shared/native/android/discord-views';
import { createInlineSurfaces } from '@unbound-plugins/shared/native/android/inline-surfaces';
import { connectTextRewrites } from '@unbound-plugins/shared/native/android/text-rewrites';
import {
	javaFlag,
	javaNumber,
	javaReference,
	javaViewKey,
} from '@unbound-plugins/shared/native/android/java-values';
import { readViewTextAsync } from '@unbound-plugins/shared/native/android/spans';
import {
	currentDecorView,
	displayDensity,
	findViewsOfClass,
	readCalls,
	runOnMain,
	scheduleStartupScans,
} from '@unbound-plugins/shared/native/android/views';

import { createRewriteRetry } from '@unbound-plugins/shared/native/android/rewrite-retry';

import { createBlockBackgroundFinder } from '~/android/block-backgrounds';
import {
	codeSlots,
	placeholderOffsets,
	placeholderTexts,
	renderedText,
	sourceBlock,
	type CodeSlot,
} from '~/android/code-ranges';
import { registerCodeCardSurface, type CardContent } from '~/components/code-card';
import { channelBlocks } from '~/android/channel-blocks';
import { settings } from '~/modules';
import { CARD_SETTINGS, Limits, PLUGIN_NAME } from '~/constants';
import { createFlatRecovery } from '~/flat-recovery';
import { onAppForeground } from '~/foreground';
import { createHighlighter } from '~/highlighter';
import { readPreferences } from '~/preferences';
import type { CodeBlock } from '~/fences';
import { codeBlockLayout } from '~/layout';

const MESSAGE_CONTENT_VIEW = 'com.discord.chat.presentation.message.view.MessageContentView';
const TOP_GAP = 2;
const MIN_WIDTH = 80;
const SIZE_PARAMETERS = ['int', 'int', 'int', 'int'];
const CONTENT_CACHE_LIMIT = 64;

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

type Card = CardContent & {
	block: CodeBlock;
	revision: number;
};

type Layout = {
	original: string;
	textView: NativeJavaReference;
	slots: CodeSlot[];
	blocks: CodeBlock[];
	surfaceIds: string[];
	density: number;
	width: number;
};

/**
 * @description Replaces the code blocks in Discord's Android message text with Shiki cards through the loader's native text rewrites, so cards stay in place while the chat scrolls.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @returns `dispose`, which removes the cards and restores the text, or `undefined` when the card surface or the native rewrites are unavailable.
 */
export function createNativeCards(native: Native) {
	const { java, hooks } = native;

	if (!connectTextRewrites(java, MESSAGE_CONTENT_VIEW)) return undefined;

	const highlighter = createHighlighter();

	highlighter.warm(readPreferences().theme);
	const cards = new Map<string, Card>();
	const listeners = createSurfaceListeners();
	const layouts = new Map<string, Layout>();
	const contentCache = new Map<string, Promise<CardContent>>();
	const pending = new Set<string>();
	const awaitingSize = new Map<string, NativeJavaReference>();
	const renderedByView = new Map<string, string>();
	const retries = createRewriteRetry();
	const blockBackgrounds = createBlockBackgroundFinder(java);
	let nextSurface = 0;
	let disposed = false;

	const surfaceModule = registerCodeCardSurface({
		card: (surfaceId) => cards.get(surfaceId),
		revision: (surfaceId) => cards.get(surfaceId)?.revision ?? -1,
		subscribe: listeners.subscribe,
	});

	if (!surfaceModule) return undefined;

	const surfaces = createInlineSurfaces(native, {
		watchedClass: MESSAGE_CONTENT_VIEW,
		surfaceModule,
		groupPrefix: 'shiki',
	});

	if (!surfaces) return undefined;

	const inline = surfaces;

	async function textGeometry(textView: NativeJavaReference) {
		const [width, left, right, attached] = await runOnMain(
			java,
			readCalls(textView, [
				'getWidth',
				'getTotalPaddingLeft',
				'getTotalPaddingRight',
				'isAttachedToWindow',
			]),
		);

		return {
			contentWidth:
				(javaNumber(width) ?? 0) - (javaNumber(left) ?? 0) - (javaNumber(right) ?? 0),
			attached: javaFlag(attached),
		};
	}

	function cardContent(block: CodeBlock, width: number): Promise<CardContent> {
		const preferences = readPreferences();
		const key = [
			block.language,
			block.code,
			block.originalCode,
			width,
			JSON.stringify(preferences),
		].join('\u0000');
		const cached = contentCache.get(key);

		if (cached) return cached;

		const content = highlighter
			.tokenize(block, preferences.theme, preferences.hljs)
			.catch(() => null)
			.then((tokens): CardContent => ({
				code: block.code,
				copyText: block.originalCode ?? block.code,
				language: block.language,
				tokens,
				width,
				appearance: highlighter.appearance(preferences.theme),
				opacity: preferences.opacity,
				overflow: preferences.overflow,
				iconMode: preferences.iconMode,
			}));

		if (contentCache.size >= CONTENT_CACHE_LIMIT)
			contentCache.delete(contentCache.keys().next().value!);

		contentCache.set(key, content);
		void content.then(({ tokens }) => {
			if (!tokens && contentCache.get(key) === content) contentCache.delete(key);
		});

		return content;
	}

	function sourceBlocks(slots: CodeSlot[]): CodeBlock[] {
		const blocks = channelBlocks();

		return slots.map((slot) => {
			const block = sourceBlock(slot.code, blocks);

			return block ? { ...block, code: slot.code } : { code: slot.code, language: 'plain' };
		});
	}

	async function define(rendered: string, layout: Layout) {
		const contents = await Promise.all(
			layout.blocks.map((block) => cardContent(block, layout.width)),
		);

		if (disposed) return;

		recovery.mark(
			rendered,
			contents.some((content) => !content.tokens),
		);

		const offsets = placeholderOffsets(layout.slots);
		const placeholders = placeholderTexts(layout.original, layout.slots);
		const heights = contents.map(
			(content) => codeBlockLayout(content.code, layout.width, content.overflow).height,
		);

		contents.forEach((content, index) => {
			const surfaceId = layout.surfaceIds[index]!;
			const previous = cards.get(surfaceId);

			cards.set(surfaceId, {
				...content,
				block: layout.blocks[index]!,
				revision: (previous?.revision ?? -1) + 1,
			});
			listeners.notify(surfaceId);
		});

		const px = (value: number) => Math.round(value * layout.density);

		const defined = inline.define({
			original: layout.original,
			rendered,
			textView: layout.textView,
			edits: layout.slots.map((slot, index) => ({
				start: slot.start,
				end: slot.end,
				text: placeholders[index]!,
				spacerOffset: 0,
				width: px(layout.width),
				height: px(heights[index]! + TOP_GAP),
				clearFrom: slot.start,
				clearTo: slot.blockEnd,
				collapseNext: true,
			})),
			slots: layout.slots.map((_, index) => ({
				surfaceId: layout.surfaceIds[index]!,
				placeholder: offsets[index]!,
				width: px(layout.width),
				height: px(heights[index]!),
				pinTop: true,
				offsetY: px(TOP_GAP),
			})),
		});
		const key = javaViewKey(layout.textView as NativeJavaValue);

		if (!key) return;

		if (defined) {
			retries.succeeded(key);
		} else {
			retries.retry(key, () => schedule(layout.textView));
		}
	}

	async function render(textView: NativeJavaReference) {
		const key = javaViewKey(textView as NativeJavaValue);
		const content = await readViewTextAsync(java, textView);

		if (!key || !content || inline.isDefined(content.string)) return;

		const hits = blockBackgrounds(content.text, content.string.length);
		const slots = codeSlots(content.string, hits).filter(
			(slot) => slot.code.length <= Limits.codeLength,
		);

		if (
			!slots.length ||
			!javaFlag(java.invoke(java.getClass(MESSAGE_CONTENT_VIEW), 'isInstance', [textView]))
		) {
			return;
		}

		const density = await displayDensity(java, textView);
		const rendered = renderedText(content.string, slots);
		const previous = layouts.get(rendered);
		const geometry = await textGeometry(textView);
		const width =
			previous && !geometry.attached ? previous.width : geometry.contentWidth / density;

		if (width < MIN_WIDTH) {
			awaitingSize.set(key, textView);

			return;
		}
		const layout: Layout = {
			original: content.string,
			textView,
			slots,
			blocks: sourceBlocks(slots),
			surfaceIds:
				previous?.surfaceIds ?? slots.map(() => `shiki-card-android-${nextSurface++}`),
			density,
			width,
		};

		layouts.set(rendered, layout);
		renderedByView.set(key, rendered);
		await define(rendered, layout);
	}

	async function resize(textView: NativeJavaReference) {
		const key = javaViewKey(textView as NativeJavaValue);
		const rendered = key ? renderedByView.get(key) : undefined;
		const layout = rendered ? layouts.get(rendered) : undefined;
		const shown = (await readViewTextAsync(java, textView))?.string;

		if (disposed || !rendered || !layout || (shown !== rendered && shown !== layout.original)) {
			return;
		}

		const width = (await textGeometry(textView)).contentWidth / layout.density;

		if (width < MIN_WIDTH || Math.abs(width - layout.width) < 1) return;

		layout.width = width;
		layout.textView = textView;
		await define(rendered, layout);
	}

	function schedule(textView: NativeJavaReference) {
		const key = javaViewKey(textView as NativeJavaValue);

		if (disposed || !key || pending.has(key)) return;

		pending.add(key);
		setTimeout(() => {
			pending.delete(key);

			if (disposed) return;

			render(textView).catch((error) => {
				if (!isCancellation(error)) {
					console.error(`[${PLUGIN_NAME}] Failed to draw an Android code card:`, error);
				}
			});
		}, 0);
	}

	const recovery = createFlatRecovery((rendered: string) => {
		const layout = layouts.get(rendered);

		if (!layout) {
			recovery.mark(rendered, false);

			return;
		}

		define(rendered, layout).catch((error) => {
			if (!isCancellation(error)) {
				console.error(`[${PLUGIN_NAME}] Failed to repaint an Android code card:`, error);
			}
		});
	}, onAppForeground);

	const token = hooks.hook(
		DRAWEE_TEXT_VIEW,
		DRAWEE_TEXT_SETTER,
		[draweeTextBuilder(java)],
		{ notify: true },
		({ self }) => {
			const textView = javaReference(self);

			if (textView) schedule(textView);
		},
	);

	const sizeToken = hooks.hook(
		MESSAGE_CONTENT_VIEW,
		'onSizeChanged',
		SIZE_PARAMETERS,
		{ notify: true },
		({ self }) => {
			const key = javaViewKey(self);
			const textView = key ? awaitingSize.get(key) : undefined;

			if (key && textView) {
				awaitingSize.delete(key);
				schedule(textView);

				return;
			}

			const resized = javaReference(self);

			if (resized) {
				resize(resized).catch((error) => {
					if (!isCancellation(error)) {
						console.error(
							`[${PLUGIN_NAME}] Failed to resize an Android code card:`,
							error,
						);
					}
				});
			}
		},
	);

	const unsubscribe = settings.addListener(
		({ key }) => CARD_SETTINGS.includes(key ?? ''),
		() => {
			for (const [rendered, layout] of layouts) {
				define(rendered, layout).catch((error) => {
					if (!isCancellation(error)) {
						console.error(
							`[${PLUGIN_NAME}] Failed to repaint an Android code card:`,
							error,
						);
					}
				});
			}
		},
	);

	async function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const textView of await findViewsOfClass(java, decor, MESSAGE_CONTENT_VIEW)) {
			schedule(textView);
		}
	}

	const scans = scheduleStartupScans('Shiki Codeblocks', scanVisible);

	return {
		dispose() {
			for (const scan of scans) clearTimeout(scan);

			disposed = true;
			hooks.remove(token);
			hooks.remove(sizeToken);
			awaitingSize.clear();
			renderedByView.clear();
			retries.clear();
			recovery.dispose();
			unsubscribe();
			layouts.clear();
			listeners.clear();
			cards.clear();

			return inline.dispose();
		},
	};
}

export default { createNativeCards };
