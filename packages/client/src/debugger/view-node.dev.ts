import type { ViewFrame, ViewNode } from '@unbound-app/debugger-protocol';

/** A rectangle in window pixels, as Android lays views out. */
export type PixelRect = { x: number; y: number; width: number; height: number };

const MAX_TEXT_LENGTH = 200;
const ANDROID_VISIBILITIES: Record<number, ViewNode['visibility']> = {
	0: 'visible',
	4: 'invisible',
	8: 'gone',
};

/**
 * @description Names an Android `View.getVisibility()` code.
 * @param code `VISIBLE` (0), `INVISIBLE` (4) or `GONE` (8).
 * @returns The visibility; an unknown code reads as `visible`.
 */
export function androidVisibility(code: number): ViewNode['visibility'] {
	return ANDROID_VISIBILITIES[code] ?? 'visible';
}

/**
 * @description Checks whether an Android view id comes from resources, so `getResourceEntryName` can name it. React Native's generated ids are small numbers with no package byte.
 * @param id The view's `getId()`.
 * @returns Whether the id has a resource package byte.
 */
export function isResourceId(id: number): boolean {
	return id > 0 && id >>> 24 !== 0;
}

/**
 * @description Cuts a view's text for the tree, dropping empty text.
 * @param text The text the view shows.
 * @returns The text up to 200 characters, or `null` when empty.
 */
export function clipText(text: string): string | null {
	if (!text) return null;

	return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;
}

/**
 * @description Places a child view in window pixels from its parent's place, the way `getLocationInWindow` does without transforms.
 * @param parent The parent's rectangle in window pixels.
 * @param child The child's `getX()`, `getY()`, `getWidth()` and `getHeight()`.
 * @param scroll The parent's `getScrollX()` and `getScrollY()`.
 * @returns The child's rectangle in window pixels.
 */
export function placeChild(
	parent: PixelRect,
	child: PixelRect,
	scroll: { x: number; y: number },
): PixelRect {
	return {
		x: parent.x + child.x - scroll.x,
		y: parent.y + child.y - scroll.y,
		width: child.width,
		height: child.height,
	};
}

/**
 * @description Converts a pixel rectangle to dp, rounded to a tenth, for display beside React Native layouts.
 * @param rect The rectangle in pixels.
 * @param density The display's pixels per dp.
 * @returns The rectangle in dp.
 */
export function toDp(rect: PixelRect, density: number): ViewFrame {
	const scale = density > 0 ? density : 1;
	const round = (value: number) => Math.round((value / scale) * 10) / 10;

	return {
		x: round(rect.x),
		y: round(rect.y),
		width: round(rect.width),
		height: round(rect.height),
	};
}

/**
 * @description Converts a dp rectangle to pixels, the inverse of {@link toDp}.
 * @param frame The rectangle in dp.
 * @param density The display's pixels per dp.
 * @returns The rectangle in pixels.
 */
export function toPixels(frame: ViewFrame, density: number): PixelRect {
	const scale = density > 0 ? density : 1;

	return {
		x: frame.x * scale,
		y: frame.y * scale,
		width: frame.width * scale,
		height: frame.height * scale,
	};
}

/**
 * @description The smallest rectangle around every given one, for outlining a component that renders several views.
 * @param frames The rectangles.
 * @returns Their bounding rectangle, or `undefined` when there are none.
 */
export function unionFrames(frames: ViewFrame[]): ViewFrame | undefined {
	if (frames.length === 0) {
		return undefined;
	}

	const left = Math.min(...frames.map((frame) => frame.x));
	const top = Math.min(...frames.map((frame) => frame.y));
	const right = Math.max(...frames.map((frame) => frame.x + frame.width));
	const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));

	return { x: left, y: top, width: right - left, height: bottom - top };
}

export default {
	androidVisibility,
	isResourceId,
	clipText,
	placeChild,
	toDp,
	toPixels,
	unionFrames,
};
