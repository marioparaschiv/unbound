import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type { NativeJavaReference, NativeJavaValue } from '@unbound-app/api/native';
import {
	MESSAGE_CONTENT_VIEW,
	messageIdAbove,
} from '@unbound-plugins/shared/native/android/discord-views';
import { RECEIVER_ONLY_AFTER_CALL } from '@unbound-plugins/shared/native/android/hook-options';
import {
	createInlineSurfaces,
	type InlineSurfaceNative,
} from '@unbound-plugins/shared/native/android/inline-surfaces';
import {
	javaFlag,
	javaNumber,
	javaReference,
	javaText,
	javaViewKey,
} from '@unbound-plugins/shared/native/android/java-values';
import { createRewriteRetry } from '@unbound-plugins/shared/native/android/rewrite-retry';
import { hasSpan, readViewTextAsync } from '@unbound-plugins/shared/native/android/spans';
import type { TextRewriteEdit } from '@unbound-plugins/shared/native/android/text-rewrites';
import { watchTextViews } from '@unbound-plugins/shared/native/android/text-views';
import { displayDensity, readCalls, runOnMain } from '@unbound-plugins/shared/native/android/views';

const MIN_WIDTH = 80;
const SIZE_PARAMETERS = ['int', 'int', 'int', 'int'];

/** Where a surface goes in a message text: the range its replacement text takes, and the placeholder in it that reserves the surface's room. */
export type TextSurfaceSlot = {
	/** Where the replaced range starts in the message text. */
	start: number;
	/** Where the replaced range ends; equal to `start` to insert. */
	end: number;
	/** The replacement text, holding the placeholder. */
	text: string;
	/** The placeholder's index in `text`. */
	placeholder: number;
	/** Room left above the surface, in density-independent pixels. */
	gap: number;
	/** Pins the surface to the top of its line, below `gap`, rather than to its bottom. */
	pinTop?: boolean;
	/** Where the source text the slot hides ends, when it runs past `end`; the line after it then collapses. */
	clearTo?: number;
};

/** A message text Discord just set, for a plugin to find slots in. */
export type MessageText = {
	view: NativeJavaReference;
	/** The `CharSequence`, to read spans from. */
	spanned: NativeJavaReference;
	string: string;
	/** Reads the id of the message the text belongs to. */
	messageId(): Promise<string | undefined>;
	/** Looks for slots in this view again, once data the plugin was missing has loaded. */
	retry(): void;
};

export type MessageTextSurfacesOptions<T extends TextSurfaceSlot> = {
	/** The registered surface module mounted in each slot. */
	surfaceModule: string;
	/** Starts each surface id and host group id. */
	prefix: string;
	/** Skips, without reading it, a text holding no span of this class, such as the background span of code blocks. */
	spanClass?: string;
	/** Finds the slots of a message text, or none to leave it as it is. */
	slots(text: MessageText): Promise<T[] | undefined>;
	/** Readies a surface's content at a width and resolves its height, both in density-independent pixels. */
	layout(surfaceId: string, slot: T, width: number): Promise<number>;
};

export type MessageTextSurfaces = {
	/** How many message texts show surfaces. */
	drawn(): number;
	/** Whether a text is still being drawn or waits to be laid out. */
	settling(): boolean;
	/** Lays out again the text holding `surfaceId`, or every text, after its content changed. */
	redraw(surfaceId?: string): void;
	/** Removes every surface and brings back the original text. */
	dispose(): Promise<void>;
};

type Layout<T extends TextSurfaceSlot> = {
	original: string;
	rendered: string;
	textView: NativeJavaReference;
	slots: T[];
	surfaceIds: string[];
	density: number;
	width: number;
};

function renderedText(original: string, slots: TextSurfaceSlot[]): string {
	return slots.reduceRight(
		(text, slot) => text.slice(0, slot.start) + slot.text + text.slice(slot.end),
		original,
	);
}

function placeholderIndexes(slots: TextSurfaceSlot[]): number[] {
	let shift = 0;

	return slots.map((slot) => {
		const index = slot.start + shift + slot.placeholder;

		shift += slot.text.length - (slot.end - slot.start);

		return index;
	});
}

/**
 * @description Shows React surfaces inside Discord's Android message text through the loader's native text rewrites: each text Discord sets is offered to `slots`, the slots' text is replaced by placeholders, and the surfaces mount over them and follow the text while the chat scrolls.
 * @template T The plugin's slot, carrying what its surfaces show.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param options The surface module, an id prefix, and how to find and lay out slots.
 * @returns The surfaces, or `undefined` when the installed loader has no native text rewrites.
 */
export function createMessageTextSurfaces<T extends TextSurfaceSlot>(
	native: InlineSurfaceNative,
	options: MessageTextSurfacesOptions<T>,
): MessageTextSurfaces | undefined {
	const { java, hooks } = native;
	const inline = createInlineSurfaces(native, {
		watchedClass: MESSAGE_CONTENT_VIEW,
		surfaceModule: options.surfaceModule,
		groupPrefix: options.prefix,
	});

	if (!inline) return undefined;

	const surfaces = inline;
	const layouts = new Map<string, Layout<T>>();
	const renderedByView = new Map<string, string>();
	const awaitingSize = new Map<string, NativeJavaReference>();
	const retries = createRewriteRetry();
	let nextSurface = 0;
	let disposed = false;

	async function geometry(textView: NativeJavaReference) {
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

	async function define(layout: Layout<T>) {
		const heights = await Promise.all(
			layout.slots.map((slot, index) =>
				options.layout(layout.surfaceIds[index]!, slot, layout.width),
			),
		);

		if (disposed) return;

		const px = (value: number) => Math.round(value * layout.density);
		const indexes = placeholderIndexes(layout.slots);
		const edits = layout.slots.map((slot, index): TextRewriteEdit => ({
			start: slot.start,
			end: slot.end,
			text: slot.text,
			spacerOffset: slot.placeholder,
			width: px(layout.width),
			height: px(heights[index]! + slot.gap),
			...(slot.clearTo === undefined
				? {}
				: { clearFrom: slot.start, clearTo: slot.clearTo, collapseNext: true }),
		}));
		const defined = surfaces.define({
			original: layout.original,
			rendered: layout.rendered,
			textView: layout.textView,
			edits,
			slots: layout.slots.map((slot, index) => ({
				surfaceId: layout.surfaceIds[index]!,
				placeholder: indexes[index]!,
				width: px(layout.width),
				height: px(heights[index]!),
				...(slot.pinTop ? { pinTop: true, offsetY: px(slot.gap) } : {}),
			})),
		});
		const key = javaViewKey(layout.textView as NativeJavaValue);

		if (!key) return;

		if (defined) {
			retries.succeeded(key);
		} else {
			retries.retry(key, () => views.schedule(layout.textView));
		}
	}

	function redefine(layout: Layout<T>) {
		define(layout).catch((error) => {
			if (!isCancellation(error)) {
				logger.error(
					`Failed to lay out the surfaces of message text ${layout.rendered}:`,
					error,
				);
			}
		});
	}

	async function draw(view: NativeJavaReference) {
		const key = javaViewKey(view as NativeJavaValue);
		const spanned = javaReference(await java.invokeAsync(view, 'getText', []));

		if (!spanned || (options.spanClass && !hasSpan(java, spanned, options.spanClass))) return;

		const string = javaText(java.invoke(spanned, 'toString', []));

		if (!key || string === undefined || surfaces.isDefined(string)) return;

		const slots = await options.slots({
			view,
			spanned,
			string,
			messageId: () => messageIdAbove(java, view),
			retry: () => views.schedule(view),
		});

		if (disposed || !slots?.length) return;

		const density = await displayDensity(java, view);
		const rendered = renderedText(string, slots);
		const previous = layouts.get(rendered);
		const { contentWidth, attached } = await geometry(view);
		// A detached view reads zero width; a text laid out before keeps the width it had.
		const width = previous && !attached ? previous.width : contentWidth / density;

		if (width < MIN_WIDTH) {
			awaitingSize.set(key, view);

			return;
		}

		awaitingSize.delete(key);

		const layout: Layout<T> = {
			original: string,
			rendered,
			textView: view,
			slots,
			surfaceIds:
				previous?.surfaceIds ?? slots.map(() => `${options.prefix}-${nextSurface++}`),
			density,
			width,
		};

		layouts.set(rendered, layout);
		renderedByView.set(key, rendered);
		await define(layout);
	}

	async function resize(view: NativeJavaReference) {
		const key = javaViewKey(view as NativeJavaValue);
		const rendered = key ? renderedByView.get(key) : undefined;
		const layout = rendered ? layouts.get(rendered) : undefined;
		const shown = (await readViewTextAsync(java, view))?.string;

		if (disposed || !layout || (shown !== layout.rendered && shown !== layout.original)) {
			return;
		}

		const width = (await geometry(view)).contentWidth / layout.density;

		if (width < MIN_WIDTH || Math.abs(width - layout.width) < 1) return;

		layout.width = width;
		layout.textView = view;
		await define(layout);
	}

	const views = watchTextViews(native, { className: MESSAGE_CONTENT_VIEW, draw });

	const sizeToken = hooks.hook(
		MESSAGE_CONTENT_VIEW,
		'onSizeChanged',
		SIZE_PARAMETERS,
		RECEIVER_ONLY_AFTER_CALL,
		({ self }) => {
			const key = javaViewKey(self);
			const waiting = key ? awaitingSize.get(key) : undefined;

			if (key && waiting) {
				awaitingSize.delete(key);
				views.schedule(waiting);

				return;
			}

			const resized = javaReference(self);

			if (!resized) return;

			resize(resized).catch((error) => {
				if (!isCancellation(error)) {
					logger.error(`Failed to resize the surfaces of text view ${key}:`, error);
				}
			});
		},
	);

	return {
		drawn: () => renderedByView.size,
		settling: () => views.busy() || awaitingSize.size > 0,
		redraw(surfaceId) {
			for (const layout of layouts.values()) {
				if (surfaceId === undefined || layout.surfaceIds.includes(surfaceId))
					redefine(layout);
			}
		},
		dispose() {
			disposed = true;
			views.dispose();
			hooks.remove(sizeToken);
			awaitingSize.clear();
			renderedByView.clear();
			retries.clear();
			layouts.clear();

			return surfaces.dispose();
		},
	};
}

export default { createMessageTextSurfaces };
