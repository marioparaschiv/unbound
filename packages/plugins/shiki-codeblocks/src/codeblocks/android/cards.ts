import { createSurfaceListeners } from '@unbound-plugins/shared/native/surface-listeners';
import type {
	NativeFabricBridge,
	NativeJavaBridge,
	NativeJavaHooksBridge,
} from '@unbound-app/api/native';
import {
	createMessageTextSurfaces,
	type TextSurfaceSlot,
} from '@unbound-plugins/shared/native/android/message-text-surfaces';
import { storage } from '@unbound-app/api';

import {
	createBlockBackgroundFinder,
	LINE_BACKGROUND_SPAN,
} from '~/codeblocks/android/block-backgrounds';
import { codeSlots, placeholderTexts, sourceBlock } from '~/codeblocks/android/code-ranges';
import { registerCodeCardSurface, type CardContent } from '~/codeblocks/components/code-card';
import { channelBlocks } from '~/codeblocks/android/channel-blocks';
import { CARD_SETTINGS, Limits } from '~/constants';
import { createFlatRecovery } from '~/codeblocks/flat-recovery';
import { onAppForeground } from '~/codeblocks/foreground';
import { createHighlighter } from '~/codeblocks/highlighter';
import { readPreferences } from '~/codeblocks/preferences';
import type { CodeBlock } from '~/codeblocks/fences';
import { codeBlockLayout } from '~/codeblocks/layout';

const TOP_GAP = 2;
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

type CardSlot = TextSurfaceSlot & {
	block: CodeBlock;
};

/**
 * @description Replaces the code blocks in Discord's Android message text with Shiki cards through the loader's native text rewrites, so cards stay in place while the chat scrolls.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @returns `progress` and `dispose`, which removes the cards and restores the text, or `undefined` when the card surface or the native rewrites are unavailable.
 */
export function createAndroidCards(native: Native) {
	const { java } = native;
	const highlighter = createHighlighter();

	highlighter.warm(readPreferences().theme);
	const cards = new Map<string, Card>();
	const listeners = createSurfaceListeners();
	const contentCache = new Map<string, Promise<CardContent>>();
	const blockBackgrounds = createBlockBackgroundFinder(java);

	const surfaceModule = registerCodeCardSurface({
		card: (surfaceId) => cards.get(surfaceId),
		revision: (surfaceId) => cards.get(surfaceId)?.revision ?? -1,
		subscribe: listeners.subscribe,
	});

	if (!surfaceModule) return undefined;

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

	const surfaces = createMessageTextSurfaces<CardSlot>(native, {
		surfaceModule,
		prefix: 'shiki-card-android',
		spanClass: LINE_BACKGROUND_SPAN,
		async slots({ spanned, string }) {
			const slots = codeSlots(string, blockBackgrounds(spanned, string.length)).filter(
				(slot) => slot.code.length <= Limits.codeLength,
			);
			const texts = placeholderTexts(string, slots);
			const blocks = channelBlocks();

			return slots.map((slot, index) => {
				const block = sourceBlock(slot.code, blocks);

				return {
					start: slot.start,
					end: slot.end,
					text: texts[index]!,
					placeholder: 0,
					gap: TOP_GAP,
					pinTop: true,
					clearTo: slot.blockEnd,
					block: block
						? { ...block, code: slot.code }
						: { code: slot.code, language: 'plain' },
				};
			});
		},
		async layout(surfaceId, slot, width) {
			const content = await cardContent(slot.block, width);
			const previous = cards.get(surfaceId);

			recovery.mark(surfaceId, !content.tokens);
			cards.set(surfaceId, {
				...content,
				block: slot.block,
				revision: (previous?.revision ?? -1) + 1,
			});
			listeners.notify(surfaceId);

			return codeBlockLayout(content.code, width, content.overflow).height;
		},
	});

	if (!surfaces) return undefined;

	const drawing = surfaces;
	const recovery = createFlatRecovery((surfaceId: string) => {
		if (cards.has(surfaceId)) drawing.redraw(surfaceId);
		else recovery.mark(surfaceId, false);
	}, onAppForeground);

	const unsubscribe = storage.onChange(
		({ store, key }) => store === addon.id && CARD_SETTINGS.includes(key ?? ''),
		() => drawing.redraw(),
	);

	return {
		progress: () => ({ drawn: drawing.drawn(), settling: drawing.settling() }),
		dispose() {
			recovery.dispose();
			unsubscribe();
			listeners.clear();
			cards.clear();

			return drawing.dispose();
		},
	};
}

export default { createAndroidCards };
