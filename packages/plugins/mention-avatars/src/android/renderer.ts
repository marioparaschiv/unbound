import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	circularBitmap,
	decodeBitmap,
	inlineDrawable,
} from '@unbound-plugins/shared/native/android/images';
import { readViewText, spansOf } from '@unbound-plugins/shared/native/android/spans';
import {
	currentDecorView,
	findViewsOfClass,
	STARTUP_SCAN_DELAYS,
} from '@unbound-plugins/shared/native/android/views';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';

import { planPlacements, type Placement, type SpanRange } from '~/android/placements';
import type { MentionIndex } from '~/mention-index';
import type { Mention } from '~/mentions';

const TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
const TEXT_BUILDER = 'com.facebook.drawee.span.DraweeSpanStringBuilder';
const TAPPABLE_SPAN = 'com.discord.span.utilities.spannable.ClickableSpan';
const BACKGROUND_SPAN = 'com.discord.span.utilities.spannable.BackgroundSpan';
const IMAGE_SIZE = 16;
const ALIGN_CENTER = 2;
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const MAX_IMAGE_BYTES = 12_000;
const MAX_TRACKED_VIEWS = 64;

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
};

type ImageEntry = {
	bitmap: NativeJavaReference | null;
	pending: boolean;
};

export type AndroidRenderer = ReturnType<typeof createAndroidRenderer>;

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

/**
 * @description Creates the renderer that draws mention images into Discord's Android message text.
 * @param native The plugin's Java and hook bridges.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a user mention keeps its `@` beside the image.
 * @returns The renderer, whose `dispose` removes its hook.
 */
export function createAndroidRenderer(
	{ java, hooks }: Native,
	index: MentionIndex,
	showAtSymbol: () => boolean,
) {
	const images = new Map<string, ImageEntry>();
	const views = new Map<string, NativeJavaReference>();
	const pending = new Set<string>();
	let imageSize = 0;
	let disposed = false;

	function sizeFor(view: NativeJavaReference, resources: NativeJavaReference): number {
		if (imageSize > 0) return imageSize;

		const metrics = javaReference(java.invoke(resources, 'getDisplayMetrics'));
		const density = metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;

		imageSize = Math.round(IMAGE_SIZE * density);

		return imageSize;
	}

	async function load(url: string) {
		images.set(url, { bitmap: null, pending: true });

		let bitmap: NativeJavaReference | null = null;

		try {
			const response = await fetch(url);
			const bytes = response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
			const source =
				bytes && bytes.length <= MAX_IMAGE_BYTES ? decodeBitmap(java, bytes) : null;

			bitmap = source && imageSize > 0 ? circularBitmap(java, source, imageSize) : null;
		} catch {
			bitmap = null;
		}

		if (disposed) return;

		images.set(url, { bitmap, pending: false });

		if (bitmap) {
			for (const view of views.values()) schedule(view);
		}
	}

	function bitmapFor(mention: Mention): NativeJavaReference | null {
		const url = mention.avatarURL;

		if (!url?.startsWith('https://')) return null;

		const entry = images.get(url);

		if (!entry) void load(url);

		return entry?.bitmap ?? null;
	}

	function mentionSpans(builder: NativeJavaReference, range: SpanRange) {
		const length = javaNumber(java.invoke(builder, 'length')) ?? 0;

		return [BACKGROUND_SPAN, TAPPABLE_SPAN].flatMap((className) =>
			spansOf(java, builder, length, className).filter(
				(hit) => hit.start <= range.start && hit.end >= range.end,
			),
		);
	}

	function apply(
		builder: NativeJavaReference,
		resources: NativeJavaReference,
		placement: Placement,
		bitmap: NativeJavaReference,
	) {
		const { range, replaceStart, replaceEnd, insertion, imageOffset } = placement;
		const spans = mentionSpans(builder, range);
		const grown = insertion.length - (replaceEnd - replaceStart);

		java.invoke(builder, 'replace', [
			javaInt(replaceStart),
			javaInt(replaceEnd),
			javaString(insertion),
		]);

		const image = replaceStart + imageOffset;
		const span = java.construct('android.text.style.ImageSpan', [
			inlineDrawable(java, resources, bitmap, imageSize),
			javaInt(ALIGN_CENTER),
		]);

		java.invoke(builder, 'setSpan', [
			span,
			javaInt(image),
			javaInt(image + 1),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);

		for (const { span: mentionSpan, flags } of spans) {
			java.invoke(builder, 'removeSpan', [mentionSpan]);
			java.invoke(builder, 'setSpan', [
				mentionSpan,
				javaInt(range.start),
				javaInt(range.end + grown),
				javaInt(flags),
			]);
		}
	}

	function render(view: NativeJavaReference) {
		const content = readViewText(java, view);

		if (!content?.string.includes('@')) return;

		const { text, string } = content;

		index.hydrateChannel();

		const mentions = index.all();

		if (!mentions.length) return;

		const tappable = spansOf(java, text, string.length, TAPPABLE_SPAN);
		const placements = planPlacements(string, tappable, mentions, showAtSymbol());

		if (!placements.length) return;

		const resources = javaReference(java.invoke(view, 'getResources'));

		if (!resources) return;

		sizeFor(view, resources);

		const ready = placements
			.map((placement) => ({ placement, bitmap: bitmapFor(placement.mention) }))
			.filter((entry): entry is { placement: Placement; bitmap: NativeJavaReference } =>
				Boolean(entry.bitmap),
			);

		if (!ready.length) return;

		const builder = java.construct('android.text.SpannableStringBuilder', [text]);

		for (const { placement, bitmap } of ready) apply(builder, resources, placement, bitmap);

		void java.invokeAsync(view, 'setText', [builder]).catch(() => undefined);
	}

	function track(key: string, view: NativeJavaReference) {
		views.delete(key);
		views.set(key, view);

		if (views.size > MAX_TRACKED_VIEWS) views.delete(views.keys().next().value!);
	}

	function schedule(view: NativeJavaReference) {
		const key = viewKey(view as NativeJavaValue);

		if (disposed || !key || pending.has(key)) return;

		pending.add(key);
		track(key, view);
		setTimeout(() => {
			pending.delete(key);

			if (disposed) return;

			try {
				render(view);
			} catch {
				views.delete(key);
			}
		}, 0);
	}

	const token = hooks.hook(
		TEXT_VIEW,
		'setDraweeSpanStringBuilder',
		[TEXT_BUILDER],
		{ notify: true },
		({ self }) => {
			const view = javaReference(self);

			if (view) schedule(view);
		},
	);

	function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const view of findViewsOfClass(java, decor, TEXT_VIEW)) schedule(view);
	}

	const scans = STARTUP_SCAN_DELAYS.map((delay) => setTimeout(scanVisible, delay));

	return {
		dispose() {
			for (const scan of scans) clearTimeout(scan);

			disposed = true;
			hooks.remove(token);
			views.clear();
			images.clear();
		},
	};
}

export default { createAndroidRenderer };
