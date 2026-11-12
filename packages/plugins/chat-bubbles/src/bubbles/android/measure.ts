import type {
	NativeJavaAssociationKey,
	NativeJavaBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import type { Box } from '~/bubbles/geometry';
import type { RowLayout } from '~/bubbles/android/row-paint';
import type { RowViewName } from '~/bubbles/android/ids';
import type { RowRead, ViewRead } from '~/bubbles/android/ui-measure';
import { union } from '~/bubbles/geometry';
import { NAME_TIME_GAP } from '~/constants';

const VISIBLE = 0;
const REACTIONS = 'com.discord.reactions.ShortcutsFlexbox';
const CONTENT = 'com.discord.chat.presentation.message.view.MessageContentView';

type Placed = { view: NativeJavaReference; box: Box; shown: boolean };

/** A measured row: its layout in points, and what the paint needs in pixels. */
export type MeasuredRow = {
	id: string;
	layout: RowLayout;
	/** Where Discord lays the avatar out, in pixels. */
	avatar: { top: number; height: number } | undefined;
	/** The reactions under the bubble, which move below its padding. */
	reactions: NativeJavaReference | undefined;
	/** Where the reactions start, in points, which the bubble never stretches past to meet the next one. */
	reactionsTop: number | undefined;
};

function placed({ view, visibility, width, height, left, top }: ViewRead, scale: number): Placed {
	return {
		view,
		shown: visibility === VISIBLE && width > 0 && height > 0,
		box: { x: left / scale, y: top / scale, width: width / scale, height: height / scale },
	};
}

/**
 * @description Measures message rows for their bubbles from one read of each row's views on the main thread.
 * @param java The plugin's Java bridge.
 * @param read Reads a row's views in one pass, or gives `null` while it waits for a layout.
 * @param mediaKey Where a rerounded media mosaic keeps Discord's own outline.
 * @returns `measure`, which reads a row's layout in points, or `undefined` for a row without content.
 */
export function createMeasure(
	java: NativeJavaBridge,
	read: (row: NativeJavaReference) => Promise<RowRead | null>,
	mediaKey: NativeJavaAssociationKey,
) {
	const contentClass = java.getClass(CONTENT);
	const radiusFields = new Map<string, string | undefined>();

	// Discord rounds a mosaic with an outline that keeps its radius in its one int field.
	function mosaicRadius(mosaic: NativeJavaReference): number | undefined {
		const outline =
			javaReference(java.getAssociatedObject(mosaic, mediaKey)) ??
			javaReference(java.invoke(mosaic, 'getOutlineProvider', []));
		const name = outline ? javaText(java.className(outline)) : undefined;

		if (!outline || !name) return;

		if (!radiusFields.has(name)) {
			const ints = java
				.describe(name)
				.fields.filter((field) => !field.static && field.type === 'int');

			radiusFields.set(name, ints.length === 1 ? ints[0]!.name : undefined);
		}

		const field = radiusFields.get(name);

		return field ? javaNumber(java.getField(outline, field)) : undefined;
	}
	const arrays = java.getClass('java.lang.reflect.Array');
	const marginSpan = java.getClass('android.text.style.LeadingMarginSpan');
	const lineBackgroundSpan = java.getClass('android.text.style.LineBackgroundSpan');
	const spanned = java.getClass('android.text.Spanned');

	function spanRanges(text: NativeJavaReference, length: number, kind: NativeJavaReference) {
		const spans = javaReference(
			java.invoke(text, 'getSpans', [javaInt(0), javaInt(length), kind]),
		);
		const count = spans ? (javaNumber(java.invoke(arrays, 'getLength', [spans])) ?? 0) : 0;

		return Array.from({ length: count }, (_, index) => {
			const span = java.invoke(arrays, 'get', [spans!, javaInt(index)]);

			return `${javaNumber(java.invoke(text, 'getSpanStart', [span])) ?? -1}-${javaNumber(java.invoke(text, 'getSpanEnd', [span])) ?? -1}`;
		});
	}

	// A code block indents its text and paints its box across the whole line, past where the text ends.
	function hasCodeBlock(view: NativeJavaReference): boolean {
		const text = javaReference(java.invoke(view, 'getText', []));
		const length = text ? (javaNumber(java.invoke(text, 'length', [])) ?? 0) : 0;

		if (!text || !javaFlag(java.invoke(spanned, 'isInstance', [text]))) return false;

		const indents = spanRanges(text, length, marginSpan);

		if (!indents.length) return false;

		const boxes = new Set(spanRanges(text, length, lineBackgroundSpan));

		return indents.some((range) => boxes.has(range));
	}

	// Where a text view's lines end, from its laid-out lines, in pixels from its left edge.
	function textRight(view: NativeJavaReference, width: number): number {
		const layout = javaReference(java.invoke(view, 'getLayout', []));

		if (!layout || hasCodeBlock(view)) return width;

		const lines = javaNumber(java.invoke(layout, 'getLineCount', [])) ?? 0;
		let right = 0;

		for (let line = 0; line < lines; line++) {
			right = Math.max(
				right,
				javaNumber(java.invoke(layout, 'getLineRight', [javaInt(line)])) ?? 0,
			);
		}

		const padding = javaNumber(java.invoke(view, 'getTotalPaddingLeft', [])) ?? 0;

		return Math.min(width, Math.ceil(right) + padding);
	}

	/**
	 * @param inset How far Discord lays the content in from the column, in points.
	 */
	return async function measure(
		row: NativeJavaReference,
		scale: number,
		inset: number,
	): Promise<MeasuredRow | undefined> {
		// Discord can move an item to another row while it is read; that row's own layout measures it again.
		const snapshot = await read(row).catch(() => null);

		if (!snapshot) return;

		const { id, width, height, paddingTop } = snapshot;
		// The content moves in by translation, which the row's own offsets leave out.
		const moved = snapshot.shift / scale;
		const views = new Map(
			(Object.entries(snapshot.views) as [RowViewName, ViewRead][]).map(([name, view]) => [
				name,
				placed(view, scale),
			]),
		);
		const items = snapshot.children
			.map((child) => ({ ...placed(child, scale), className: child.className }))
			.filter((item) => item.shown)
			.map((item) => ({ ...item, box: { ...item.box, x: item.box.x + moved } }));
		const reactions = items.find((item) => item.className === REACTIONS);
		const content = items.filter((item) => item !== reactions);
		const body = union(
			content.map(({ box }) => ({
				left: box.x,
				top: box.y,
				right: box.x + box.width,
				bottom: box.y + box.height,
			})),
		);

		if (!body) return;

		const rights = content.map(({ view, box }) =>
			javaFlag(java.invoke(contentClass, 'isInstance', [view]))
				? box.x + textRight(view, box.width * scale) / scale
				: box.x + box.width,
		);
		const header = views.get('header');
		const name = views.get('author_name');
		const start = Boolean(name?.shown && header);
		const heading = start && header ? headingOf(views, header.box, scale) : undefined;
		const replyText = views.get('reply_text');
		const avatar = views.get('author_avatar');
		const mosaic = views.get('mosaic');
		const mediaRadius = mosaic?.shown ? mosaicRadius(mosaic.view) : undefined;
		const column = header ? Math.min(body.left, header.box.x) : body.left;
		// A forwarded message's content sits further in than the name; its bubble still starts in line with the name.
		const left = header ? Math.min(body.left, header.box.x + inset) : body.left;
		const columnBox = {
			x: column,
			y: start && header ? Math.min(header.box.y, body.top) : body.top,
			width: body.right - column,
			height: body.bottom - (start && header ? Math.min(header.box.y, body.top) : body.top),
		};

		return {
			id,
			layout: {
				width: width / scale,
				height: height / scale,
				start,
				...(start && header ? { headerBottom: header.box.y + header.box.height } : {}),
				...(heading ? { heading } : {}),
				replyTextWidth:
					heading?.reply && replyText
						? textRight(replyText.view, replyText.box.width * scale) / scale
						: 0,
				body: {
					x: left,
					y: body.top,
					width: body.right - left,
					height: body.bottom - body.top,
				},
				contentRight: Math.max(...rights),
				column: columnBox,
				...(mosaic && mediaRadius !== undefined
					? {
							media: {
								top: mosaic.box.y,
								bottom: mosaic.box.y + mosaic.box.height,
								radius: mediaRadius / scale,
							},
						}
					: {}),
			},
			avatar: avatar ? avatarBox(avatar, start, paddingTop, scale) : undefined,
			reactions: reactions?.view,
			reactionsTop: reactions?.box.y,
		};
	};

	function avatarBox(avatar: Placed, start: boolean, paddingTop: number, scale: number) {
		const params = javaReference(java.invoke(avatar.view, 'getLayoutParams', []));
		const fixed = params ? (javaNumber(java.getField(params, 'height')) ?? 0) : 0;
		const margin = params ? (javaNumber(java.getField(params, 'topMargin')) ?? 0) : 0;

		return {
			top: start && avatar.shown ? avatar.box.y * scale : paddingTop + margin,
			height: fixed > 0 ? fixed : avatar.box.height * scale,
		};
	}

	// Where a text view's capitals start below its top, in pixels: its line box leaves room above them.
	function capitalTop(view: NativeJavaReference): number | undefined {
		const paint = javaReference(java.invoke(view, 'getPaint', []));

		if (!paint) return;

		const bounds = java.construct('android.graphics.Rect', []);

		java.invoke(paint, 'getTextBounds', [javaString('H'), javaInt(0), javaInt(1), bounds]);

		const baseline = javaNumber(java.invoke(view, 'getBaseline', []));
		const top = javaNumber(java.getField(bounds, 'top'));

		return baseline === undefined || top === undefined ? undefined : baseline + top;
	}

	function headingOf(
		views: Map<RowViewName, Placed>,
		header: Box,
		scale: number,
	): RowLayout['heading'] {
		const time = views.get('timestamp');
		const name = views.get('author_name')!;
		const capitals = capitalTop(name.view);
		const preview = views.get('reply_preview_view');
		const leading = views.get('reply_leading_views');
		const text = views.get('reply_text');
		const nameWidth = time?.shown
			? time.box.x - header.x - NAME_TIME_GAP
			: name.box.x + name.box.width - header.x;
		const reply =
			preview?.shown && text?.shown
				? {
						container: preview.box,
						content: unionBox(
							[leading, text]
								.filter((part): part is Placed => Boolean(part?.shown))
								.map(({ box }) => box),
						),
						label: 0,
						labelX: text.box.x,
					}
				: undefined;

		return {
			name: header,
			nameWidth,
			...(capitals === undefined ? {} : { capitalTop: capitals / scale }),
			...(time?.shown ? { time: time.box } : {}),
			...(reply ? { reply } : {}),
		};
	}
}

function unionBox(boxes: Box[]): Box {
	const edges = union(
		boxes.map((box) => ({
			left: box.x,
			top: box.y,
			right: box.x + box.width,
			bottom: box.y + box.height,
		})),
	)!;

	return {
		x: edges.left,
		y: edges.top,
		width: edges.right - edges.left,
		height: edges.bottom - edges.top,
	};
}

export default { createMeasure };
