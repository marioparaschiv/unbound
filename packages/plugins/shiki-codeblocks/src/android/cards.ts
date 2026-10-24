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
	createHost,
	hostContainer,
	layoutHostingList,
	hostHasContent,
	placeHost,
	removeHost,
	reservedTop,
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
import { readViewText, spansOf } from '@unbound-plugins/shared/native/android/spans';
import {
	currentDecorView,
	findViewsOfClass,
	STARTUP_SCAN_DELAYS,
} from '@unbound-plugins/shared/native/android/views';

import { codeSlots, placeholderOffsets, sourceBlock, type CodeSlot } from '~/android/code-ranges';
import { registerCodeCardSurface, type CardContent } from '~/components/code-card';
import { MessageStore, SelectedChannelStore, settings } from '~/modules';
import { CARD_SETTINGS, Limits, PLUGIN_NAME } from '~/constants';
import { createHighlighter } from '~/highlighter';
import { readPreferences } from '~/preferences';
import { parseFencedCodeBlocks, type CodeBlock } from '~/fences';
import { codeBlockLayout } from '~/layout';

const TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
const TEXT_BUILDER = 'com.facebook.drawee.span.DraweeSpanStringBuilder';
const MESSAGE_CONTENT_VIEW = 'com.discord.chat.presentation.message.view.MessageContentView';
const BLOCK_BACKGROUND_SPAN = 'com.discord.span.utilities.spannable.BlockBackgroundSpan';
const IMAGE_SPAN = 'android.text.style.ImageSpan';
const ANY_SPAN = 'java.lang.Object';
const SIZE_SPAN = 'android.text.style.AbsoluteSizeSpan';
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const PLACEHOLDER = '￼';
const TOP_GAP = 2;
const MIN_WIDTH = 80;
const SIZE_PARAMETERS = ['int', 'int', 'int', 'int'];
const SETTLE_DELAYS = [0, 120, 600];

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

type Message = {
	content?: unknown;
};

type Card = CardContent & {
	id: string;
	block: CodeBlock;
	host: NativeJavaHandle;
	mounting: Promise<NativeFabricSurface> | null;
	placeholder: number;
	height: number;
	revision: number;
	disposed: boolean;
};

type ViewCards = {
	textView: NativeJavaReference;
	original: NativeJavaReference;
	density: number;
	renderedText: string;
	cards: Card[];
};

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

function channelBlocks(): CodeBlock[] {
	const channelId = SelectedChannelStore.getChannelId();
	const messages: Message[] = MessageStore.getMessages(channelId)?._array ?? [];

	return messages.flatMap((message) =>
		typeof message.content === 'string' && message.content.includes('```')
			? parseFencedCodeBlocks(message.content)
			: [],
	);
}

/**
 * @description Replaces the code blocks in Discord's Android message text with Shiki cards drawn like the iOS ones.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @returns `dispose`, which removes the hook and every card and resolves once the views are restored, or `undefined` when the card surface did not register.
 */
export function createAndroidCards({ java, hooks, fabric }: Native) {
	const highlighter = createHighlighter();
	const views = new Map<string, ViewCards>();
	const byId = new Map<string, Card>();
	const pending = new Set<string>();
	const renders = new Map<string, Promise<void>>();
	const awaitingSize = new Map<string, NativeJavaReference>();
	let nextId = 0;
	let disposed = false;

	const listeners = new Map<string, Set<() => void>>();
	const surfaceModule = registerCodeCardSurface({
		card: (surfaceId) => byId.get(surfaceId),
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

	function publish(card: Card) {
		for (const listener of listeners.get(card.id) ?? []) listener();
	}

	if (!surfaceModule) return undefined;

	function displayDensity(textView: NativeJavaReference): number {
		const resources = javaReference(java.invoke(textView, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
	}

	function textWidth(textView: NativeJavaReference, density: number): number {
		return (
			((javaNumber(java.invoke(textView, 'getWidth', [])) ?? 0) -
				(javaNumber(java.invoke(textView, 'getTotalPaddingLeft', [])) ?? 0) -
				(javaNumber(java.invoke(textView, 'getTotalPaddingRight', [])) ?? 0)) /
			density
		);
	}

	async function teardown(card: Card) {
		card.disposed = true;
		byId.delete(card.id);

		const mounted = await card.mounting?.catch(() => null);

		if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);

		await removeHost(java, card.host).catch(() => undefined);
	}

	async function cardContent(block: CodeBlock, width: number) {
		const preferences = readPreferences();
		const tokens = await highlighter
			.tokenize(block, preferences.theme, preferences.hljs)
			.catch(() => null);

		return {
			code: block.code,
			copyText: block.originalCode ?? block.code,
			language: block.language,
			tokens,
			width,
			appearance: highlighter.appearance(preferences.theme),
			opacity: preferences.opacity,
			overflow: preferences.overflow,
			iconMode: preferences.iconMode,
		} satisfies CardContent;
	}

	function setSpacer(builder: NativeJavaReference, entry: ViewCards, card: Card) {
		for (const hit of spansOf(java, builder, entry.renderedText.length, IMAGE_SPAN)) {
			if (hit.start === card.placeholder) java.invoke(builder, 'removeSpan', [hit.span]);
		}

		java.invoke(builder, 'setSpan', [
			spacerSpan(java, card.width * entry.density, (card.height + TOP_GAP) * entry.density),
			javaInt(card.placeholder),
			javaInt(card.placeholder + 1),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);
	}

	function collapseLineEnd(builder: NativeJavaReference, entry: ViewCards, card: Card) {
		if (entry.renderedText[card.placeholder + 1] !== '\n') return;

		java.invoke(builder, 'setSpan', [
			java.construct(SIZE_SPAN, [javaInt(1)]),
			javaInt(card.placeholder + 1),
			javaInt(card.placeholder + 2),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);
	}

	async function restore(entry: ViewCards) {
		const current = readViewText(java, entry.textView);

		if (current?.string === entry.renderedText) {
			await java.invokeAsync(entry.textView, 'setText', [entry.original]);
			await java.invokeAsync(entry.textView, 'requestLayout', []);
			await layoutHostingList(java, entry.textView);
		}
	}

	async function commit(entry: ViewCards, builder: NativeJavaReference) {
		entry.renderedText = javaText(java.invoke(builder, 'toString', [])) ?? '';
		await java.invokeAsync(entry.textView, 'setText', [builder]);
		await java.invokeAsync(entry.textView, 'requestLayout', []);
		await layoutHostingList(java, entry.textView);
	}

	function isCurrent(entry: ViewCards, card: Card): boolean {
		return (
			!card.disposed &&
			views.get(viewKey(entry.textView as NativeJavaValue) ?? '') === entry &&
			entry.cards.includes(card) &&
			readViewText(java, entry.textView)?.string === entry.renderedText
		);
	}

	async function place(entry: ViewCards, card: Card) {
		if (!isCurrent(entry, card)) return;

		const height = card.height * entry.density;
		const container = hostContainer(java, entry.textView);
		const position = reservedTop(java, entry.textView, card.placeholder);

		if (!container || !position) return;

		await placeHost(
			java,
			card.host,
			container.container,
			{
				x: container.offset.x + position.x,
				y: container.offset.y + position.y + TOP_GAP * entry.density,
			},
			{ width: card.width * entry.density, height },
		);

		if (!isCurrent(entry, card)) {
			if (card.disposed || !entry.cards.includes(card)) {
				await removeHost(java, card.host).catch(() => undefined);
			}

			return;
		}

		if (card.mounting && !card.disposed) {
			const mounted = await card.mounting.catch(() => null);

			if (!hostHasContent(java, card.host)) {
				card.mounting = null;

				if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);
			}
		}

		if (!card.mounting && !card.disposed) {
			card.mounting = fabric.mountAsync(card.host, surfaceModule!, { surfaceId: card.id });
			await card.mounting.catch((error: unknown) => {
				card.mounting = null;
				throw error;
			});
		}
	}

	function settle(entry: ViewCards) {
		for (const delay of SETTLE_DELAYS) {
			setTimeout(() => {
				for (const card of entry.cards) {
					place(entry, card).catch((error) => {
						console.error(
							`[${PLUGIN_NAME}] Failed to place an Android code card:`,
							error,
						);
					});
				}
			}, delay);
		}
	}

	function isMessageText(textView: NativeJavaReference): boolean {
		return javaFlag(java.invoke(java.getClass(MESSAGE_CONTENT_VIEW), 'isInstance', [textView]));
	}

	function sourceBlocks(slots: CodeSlot[]): CodeBlock[] {
		const blocks = channelBlocks();

		return slots.map((slot) => {
			const block = sourceBlock(slot.code, blocks);

			return block ? { ...block, code: slot.code } : { code: slot.code, language: 'plain' };
		});
	}

	async function render(textView: NativeJavaReference) {
		const key = viewKey(textView as NativeJavaValue);
		const content = readViewText(java, textView);

		if (!key || !content) return;

		const existing = views.get(key);

		if (existing?.renderedText === content.string) {
			settle(existing);

			return;
		}

		const hits = spansOf(java, content.text, content.string.length, BLOCK_BACKGROUND_SPAN);
		const slots = codeSlots(content.string, hits).filter(
			(slot) => slot.code.length <= Limits.codeLength,
		);

		if (!slots.length || !isMessageText(textView)) {
			if (existing) {
				views.delete(key);

				for (const card of existing.cards) void teardown(card);
			}

			return;
		}

		const density = displayDensity(textView);
		const width = textWidth(textView, density);

		if (width < MIN_WIDTH) {
			awaitingSize.set(key, textView);

			return;
		}

		const blocks = sourceBlocks(slots);
		const contents = await Promise.all(blocks.map((block) => cardContent(block, width)));
		const current = readViewText(java, textView);

		if (disposed || current?.string !== content.string) return;

		const reusable = existing?.cards ?? [];
		const offsets = placeholderOffsets(slots);
		const cards = contents.map((cardContent, index): Card => {
			const previous = reusable[index];
			const fields = {
				...cardContent,
				block: blocks[index]!,
				placeholder: offsets[index]!,
				height: codeBlockLayout(cardContent.code, width, cardContent.overflow).height,
			};

			if (previous && !previous.disposed && previous.code === cardContent.code) {
				return Object.assign(previous, fields, { revision: previous.revision + 1 });
			}

			return {
				...fields,
				id: `shiki-card-android-${nextId++}`,
				host: createHost(java, textView),
				mounting: null,
				revision: 0,
				disposed: false,
			};
		});

		for (const card of reusable) {
			if (!cards.includes(card)) void teardown(card);
		}

		const entry: ViewCards = {
			textView,
			original: current.text,
			density,
			renderedText: '',
			cards,
		};
		const builder = java.construct('android.text.SpannableStringBuilder', [current.text]);
		const length = current.string.length;

		for (const hit of spansOf(java, builder, length, ANY_SPAN)) {
			if (slots.some((slot) => hit.start >= slot.start && hit.end <= slot.blockEnd)) {
				java.invoke(builder, 'removeSpan', [hit.span]);
			}
		}

		for (const slot of slots.slice().reverse()) {
			java.invoke(builder, 'replace', [
				javaInt(slot.start),
				javaInt(slot.end),
				javaString(PLACEHOLDER),
			]);
		}

		entry.renderedText = javaText(java.invoke(builder, 'toString', [])) ?? '';

		for (const card of cards) {
			byId.set(card.id, card);
			setSpacer(builder, entry, card);
			collapseLineEnd(builder, entry, card);
			publish(card);
		}

		views.set(key, entry);
		await commit(entry, builder);
		settle(entry);
	}

	async function repaint(entry: ViewCards) {
		const content = readViewText(java, entry.textView);

		if (!content || content.string !== entry.renderedText) return;

		const width = textWidth(entry.textView, entry.density);

		for (const card of entry.cards) {
			Object.assign(card, await cardContent(card.block, width), {
				revision: card.revision + 1,
			});
			card.height = codeBlockLayout(card.code, card.width, card.overflow).height;
		}

		const current = readViewText(java, entry.textView);

		if (disposed || current?.string !== entry.renderedText) return;

		const builder = java.construct('android.text.SpannableStringBuilder', [current.text]);

		for (const card of entry.cards) {
			setSpacer(builder, entry, card);
			publish(card);
		}

		await commit(entry, builder);
		settle(entry);
	}

	function schedule(textView: NativeJavaReference) {
		const key = viewKey(textView as NativeJavaValue);

		if (disposed || !key || pending.has(key)) return;

		pending.add(key);
		setTimeout(() => {
			pending.delete(key);

			if (disposed) return;

			const previous = renders.get(key) ?? Promise.resolve();
			const next = previous
				.then(() => render(textView))
				.catch((error) => {
					console.error(`[${PLUGIN_NAME}] Failed to draw an Android code card:`, error);
				})
				.finally(() => {
					if (renders.get(key) === next) renders.delete(key);
				});

			renders.set(key, next);
		}, 0);
	}

	const token = hooks.hook(
		TEXT_VIEW,
		'setDraweeSpanStringBuilder',
		[TEXT_BUILDER],
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
			const key = viewKey(self);
			const textView = key ? awaitingSize.get(key) : undefined;

			if (!key || !textView) return;

			awaitingSize.delete(key);
			schedule(textView);
		},
	);

	const unsubscribe = settings.addListener(
		({ key }) => CARD_SETTINGS.includes(key ?? ''),
		() => {
			for (const entry of views.values()) {
				repaint(entry).catch((error) => {
					console.error(
						`[${PLUGIN_NAME}] Failed to repaint an Android code card:`,
						error,
					);
				});
			}
		},
	);

	function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const textView of findViewsOfClass(java, decor, MESSAGE_CONTENT_VIEW)) {
			schedule(textView);
		}
	}

	const scans = STARTUP_SCAN_DELAYS.map((delay) => setTimeout(scanVisible, delay));

	return {
		dispose() {
			for (const scan of scans) clearTimeout(scan);

			disposed = true;
			hooks.remove(token);
			hooks.remove(sizeToken);
			awaitingSize.clear();
			unsubscribe();

			const pending = [...views.values()].flatMap((entry) => [
				...entry.cards.map(teardown),
				restore(entry),
			]);

			views.clear();
			listeners.clear();

			return Promise.all(pending).then(() => undefined);
		},
	};
}

export default { createAndroidCards };
