export type TextRewriteEdit = {
	start: number;
	end: number;
	text: string;
	spacerOffset?: number;
	width?: number;
	height?: number;
	clearFrom?: number;
	clearTo?: number;
	collapseNext?: boolean;
	imageKey?: string;
	imageOffset?: number;
	imageSize?: number;
	stretchFrom?: number;
	stretchTo?: number;
	stretchClasses?: string[];
};

export type TextRewriteAnchor = {
	placeholder: number;
	width: number;
	height: number;
	pinTop?: boolean;
	offsetY?: number;
};

export type TextEdit = Required<Omit<TextRewriteEdit, 'imageKey'>> & { imageKey?: string };

export type TextPlacement = { x: number; y: number };

/**
 * @description Fills an edit's optional fields with the values that turn each feature off.
 * @param edit The edit a plugin sent.
 * @returns The edit with every field set.
 */
export function normalizeEdit(edit: TextRewriteEdit): TextEdit {
	'worklet';

	return {
		start: edit.start,
		end: edit.end,
		text: edit.text,
		spacerOffset: edit.spacerOffset ?? -1,
		width: edit.width ?? 0,
		height: edit.height ?? 0,
		clearFrom: edit.clearFrom ?? -1,
		clearTo: edit.clearTo ?? -1,
		collapseNext: edit.collapseNext ?? false,
		imageKey: edit.imageKey || undefined,
		imageOffset: edit.imageOffset ?? 0,
		imageSize: edit.imageSize ?? 0,
		stretchFrom: edit.stretchFrom ?? -1,
		stretchTo: edit.stretchTo ?? -1,
		stretchClasses: edit.stretchClasses ?? [],
	};
}

/**
 * @description Places a host on its placeholder's line, from the text view's origin in the host's container.
 * @param anchor The placeholder, the host's size, and whether it pins to the line's top.
 * @param origin The text view's offset in the container.
 * @param horizontal The placeholder's horizontal position in the text layout.
 * @param lineTop The top of the placeholder's line.
 * @param lineBottom The bottom of the placeholder's line.
 * @param padding The text view's total left and top padding.
 * @returns Where the host goes in its container.
 */
export function placement(
	anchor: TextRewriteAnchor,
	origin: TextPlacement,
	horizontal: number,
	lineTop: number,
	lineBottom: number,
	padding: TextPlacement,
): TextPlacement {
	'worklet';
	const lineY = anchor.pinTop ? lineTop : lineBottom - anchor.height;

	return {
		x: origin.x + horizontal + padding.x,
		y: origin.y + lineY + padding.y + (anchor.offsetY ?? 0),
	};
}

/**
 * @description Checks that an edit's range lies inside the text.
 * @param edit The edit.
 * @param length The text's length.
 * @returns Whether the edit can apply.
 */
export function fits(edit: TextEdit, length: number): boolean {
	'worklet';

	return edit.end <= length && edit.start <= edit.end;
}

/**
 * @description Moves a position in a text through later edits, so a placeholder stays on its character.
 * @param position The position before the edits.
 * @param edits The edits applied after the position was taken.
 * @returns The position after the edits.
 */
export function mapThrough(position: number, edits: TextEdit[]): number {
	'worklet';
	let shift = 0;

	for (const edit of [...edits].sort((left, right) => left.start - right.start)) {
		if (position >= edit.end) {
			shift += edit.text.length - (edit.end - edit.start);
		} else if (position >= edit.start) {
			return edit.start + shift;
		}
	}

	return position + shift;
}

/**
 * @description Checks whether an edit stretches the spans over a window of the text.
 * @param edit The edit.
 * @returns Whether it names span classes and a non-empty window.
 */
export function stretches(edit: TextEdit): boolean {
	'worklet';

	return edit.stretchClasses.length > 0 && edit.stretchTo > edit.stretchFrom;
}

/**
 * @description Checks whether a span overlaps an edit's stretch window.
 * @param spanStart The span's start.
 * @param spanEnd The span's end.
 * @param edit The edit.
 * @returns Whether they overlap.
 */
export function overlapsStretch(spanStart: number, spanEnd: number, edit: TextEdit): boolean {
	'worklet';

	return spanStart < edit.stretchTo && spanEnd > edit.stretchFrom;
}

/**
 * @description Checks whether a span covers exactly an edit's stretch window.
 * @param spanStart The span's start.
 * @param spanEnd The span's end.
 * @param edit The edit.
 * @returns Whether it covers the window.
 */
export function covers(spanStart: number, spanEnd: number, edit: TextEdit): boolean {
	'worklet';

	return spanStart === edit.stretchFrom && spanEnd === edit.stretchTo;
}

/**
 * @description Computes where a span lies after an edit replaced its window, growing a stretched span with the replacement.
 * @param stretch Whether the span stretches over the window.
 * @param spanStart The span's start after the replacement.
 * @param spanEnd The span's end after the replacement.
 * @param edit The edit.
 * @returns The span's start and end, or `undefined` when it no longer covers any text.
 */
export function restretchedRange(
	stretch: boolean,
	spanStart: number,
	spanEnd: number,
	edit: TextEdit,
): [number, number] | undefined {
	'worklet';
	const grown = edit.text.length - (edit.end - edit.start);
	const start = stretch ? edit.stretchFrom : spanStart;
	const end = stretch ? edit.stretchTo + grown : spanEnd;

	return start >= 0 && end > start ? [start, end] : undefined;
}

export default {
	covers,
	fits,
	mapThrough,
	normalizeEdit,
	overlapsStretch,
	placement,
	restretchedRange,
	stretches,
};
