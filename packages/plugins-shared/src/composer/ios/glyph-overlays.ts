import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

const HIDDEN_FONT_SIZE = 0.01;
const ASPECT_FIT = 1;

type BoxedRect = {
	value?: BoxedRect;
	origin?: { x?: number; y?: number };
	size?: { width?: number; height?: number };
};

type BoxedInset = { value?: BoxedInset; top?: number; left?: number };

const MAX_SEARCH_DEPTH = 60;

function subviewsOf(objc: NativeObjCBridge, view: NativeObjectHandle): NativeObjectHandle[] {
	'worklet';
	const subviews = objc.invoke(view, 'subviews', []);

	if (Array.isArray(subviews)) return subviews as NativeObjectHandle[];

	return subviews ? (objc.array(subviews as NativeObjectHandle) as NativeObjectHandle[]) : [];
}

function insetOf(raw: unknown) {
	'worklet';
	const boxed = raw as BoxedInset | null;
	const inset = boxed?.value ?? boxed;

	return { top: Number(inset?.top ?? 0), left: Number(inset?.left ?? 0) };
}

function rectOf(raw: unknown) {
	'worklet';
	const boxed = raw as BoxedRect | null;
	const rect = boxed?.value ?? boxed;

	return {
		x: Number(rect?.origin?.x ?? 0),
		y: Number(rect?.origin?.y ?? 0),
		width: Number(rect?.size?.width ?? 0),
		height: Number(rect?.size?.height ?? 0),
	};
}

/**
 * @description Removes every overlay with a tag from a text view, including ones an earlier session left behind.
 * @param objc The Objective-C bridge.
 * @param textView The composer's text view.
 * @param tag The tag the overlays carry.
 */
export function removeTaggedOverlays(
	objc: NativeObjCBridge,
	textView: NativeObjectHandle,
	tag: number,
) {
	'worklet';

	for (
		let found = objc.call(textView, 'viewWithTag:', tag);
		found;
		found = objc.call(textView, 'viewWithTag:', tag)
	) {
		objc.invoke(found as NativeObjectHandle, 'removeFromSuperview', []);
	}
}

/**
 * @description Hides a run of text without changing it: the glyphs shrink to nothing and the run's last composed
 * character carries one square's width, so an image placed over it lines up and the text that gets sent stays the same. Colour emoji ignore text
 * colour, so shrinking is the only way to hide them.
 * @param objc The Objective-C bridge.
 * @param storage The text view's text storage.
 * @param start The run's UTF-16 offset.
 * @param length The run's UTF-16 length.
 * @param side The square's side, usually the line height.
 * @param lastLength The UTF-16 length of the run's last composed character, which carries the width; a whole emoji
 * when the run is one, since splitting a surrogate pair drops the attribute.
 */
export function hideRun(
	objc: NativeObjCBridge,
	storage: NativeObjectHandle,
	start: number,
	length: number,
	side: number,
	lastLength = 1,
) {
	'worklet';
	const tiny = objc.call(objc.getClass('UIFont')!, 'systemFontOfSize:', HIDDEN_FONT_SIZE);
	const clear = objc.call(objc.getClass('UIColor')!, 'clearColor');
	const whole = objc.struct('NSRange', { location: start, length });
	const last = objc.struct('NSRange', {
		location: start + length - lastLength,
		length: lastLength,
	});

	objc.call(storage, 'addAttribute:value:range:', 'NSFont', tiny, whole);
	objc.call(storage, 'addAttribute:value:range:', 'NSColor', clear, whole);
	objc.call(storage, 'addAttribute:value:range:', 'NSKern', side, last);
}

/**
 * @description Undoes `hideRun`: gives a run the text view's own font and colour back and drops its kern.
 * @param objc The Objective-C bridge.
 * @param textView The text view.
 * @param storage The text view's text storage.
 * @param start The run's UTF-16 offset.
 * @param length The run's UTF-16 length.
 */
export function showRun(
	objc: NativeObjCBridge,
	textView: NativeObjectHandle,
	storage: NativeObjectHandle,
	start: number,
	length: number,
) {
	'worklet';
	const font = objc.call(textView, 'font');
	const color = objc.call(textView, 'textColor');
	const whole = objc.struct('NSRange', { location: start, length });

	if (font) objc.call(storage, 'addAttribute:value:range:', 'NSFont', font, whole);
	if (color) objc.call(storage, 'addAttribute:value:range:', 'NSColor', color, whole);
	objc.call(storage, 'removeAttribute:range:', 'NSKern', whole);
}

function overlayFrame(
	objc: NativeObjCBridge,
	textView: NativeObjectHandle,
	start: number,
	side: number,
) {
	'worklet';
	const layout = objc.call(textView, 'layoutManager') as NativeObjectHandle | null;
	const container = objc.call(textView, 'textContainer') as NativeObjectHandle | null;

	if (!layout || !container) return null;

	objc.call(layout, 'ensureLayoutForTextContainer:', container);

	const glyph = Number(objc.call(layout, 'glyphIndexForCharacterAtIndex:', start));
	const line = rectOf(
		objc.call(layout, 'lineFragmentUsedRectForGlyphAtIndex:effectiveRange:', glyph, null),
	);
	const at = rectOf(
		objc.call(
			layout,
			'boundingRectForGlyphRange:inTextContainer:',
			objc.struct('NSRange', { location: glyph, length: 1 }),
			container,
		),
	);
	const inset = insetOf(objc.call(textView, 'textContainerInset'));

	if (line.height <= 0) return null;

	return objc.struct('CGRect', {
		origin: { x: at.x + inset.left, y: line.y + inset.top + (line.height - side) / 2 },
		size: { width: side, height: side },
	});
}

/**
 * @description Places an image view over a hidden run, centred on its line.
 * @param objc The Objective-C bridge.
 * @param textView The composer's text view.
 * @param start The run's UTF-16 offset.
 * @param side The square's side.
 * @param image The image, animated or not.
 * @param tag The tag, so later paints can remove it.
 * @returns The view, or `null` when the run is not laid out yet.
 */
export function placeOverlay(
	objc: NativeObjCBridge,
	textView: NativeObjectHandle,
	start: number,
	side: number,
	image: NativeObjectHandle,
	tag: number,
): NativeObjectHandle | null {
	'worklet';
	const frame = overlayFrame(objc, textView, start, side);

	if (!frame) return null;

	const viewClass = objc.getClass('SDAnimatedImageView') ? 'SDAnimatedImageView' : 'UIImageView';
	const view = objc.create(viewClass, 'initWithFrame:', [frame]) as NativeObjectHandle | null;

	if (!view) return null;

	objc.invoke(view, 'setImage:', [image]);
	objc.invoke(view, 'setContentMode:', [ASPECT_FIT]);
	objc.invoke(view, 'setUserInteractionEnabled:', [false]);
	objc.invoke(view, 'setTag:', [tag]);
	objc.invoke(textView, 'addSubview:', [view]);

	return view;
}

/**
 * @description Moves an overlay back over its run after the text around it re-laid out, such as when another plugin
 * hid a run before it. Only the frame changes, so the text view does not lay out again.
 * @param objc The Objective-C bridge.
 * @param textView The composer's text view.
 * @param start The run's UTF-16 offset.
 * @param side The square's side.
 * @param view The overlay.
 */
export function positionOverlay(
	objc: NativeObjCBridge,
	textView: NativeObjectHandle,
	start: number,
	side: number,
	view: NativeObjectHandle,
) {
	'worklet';
	const frame = overlayFrame(objc, textView, start, side);

	if (frame) objc.invoke(view, 'setFrame:', [frame]);
}

/**
 * @description Moves a plugin's overlays back over their runs after the text re-laid out, finding them again by tag in
 * the order they were placed, since view handles from an earlier UI call can't be reused.
 * @param objc The Objective-C bridge.
 * @param textView The composer's text view.
 * @param tag The plugin's overlay tag.
 * @param starts Each overlay's run offset, in the order the overlays were added.
 * @param side The square's side.
 */
export function repositionTaggedOverlays(
	objc: NativeObjCBridge,
	textView: NativeObjectHandle,
	tag: number,
	starts: number[],
	side: number,
) {
	'worklet';
	const overlays = subviewsOf(objc, textView).filter(
		(view) => Number(objc.invoke(view, 'tag', [])) === tag,
	);

	overlays.forEach((view, index) => {
		const start = starts[index];

		if (start !== undefined) positionOverlay(objc, textView, start, side, view);
	});
}

/**
 * @description Loads an image file, animated when it is a GIF and the app ships SDWebImage's animated image.
 * @param objc The Objective-C bridge.
 * @param path The file's absolute path.
 * @returns The image, or `null` when it can't be read.
 */
export function loadOverlayImage(objc: NativeObjCBridge, path: string): NativeObjectHandle | null {
	'worklet';
	const animated = objc.getClass('SDAnimatedImage');
	const image = animated
		? objc.call(animated, 'imageWithContentsOfFile:', path)
		: objc.call(objc.getClass('UIImage')!, 'imageWithContentsOfFile:', path);

	return (image as NativeObjectHandle | null) ?? null;
}

function viewsOfClass(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	className: string,
	depth: number,
): NativeObjectHandle[] {
	'worklet';

	if (objc.className(view) === className) return [view];

	if (depth >= MAX_SEARCH_DEPTH) return [];

	return subviewsOf(objc, view).flatMap((child) =>
		viewsOfClass(objc, child, className, depth + 1),
	);
}

/**
 * @description Finds the text views of a class in every window, such as the composers on screen, so they can be drawn
 * again without keeping handles from an earlier UI call.
 * @param objc The Objective-C bridge.
 * @param className The text view's class.
 * @returns The views.
 */
export function visibleTextViews(objc: NativeObjCBridge, className: string): NativeObjectHandle[] {
	'worklet';
	const application = objc.call(objc.getClass('UIApplication')!, 'sharedApplication');
	const windows = objc.invoke(application as NativeObjectHandle, 'windows', []);
	const list = (
		Array.isArray(windows) ? windows : objc.array(windows as NativeObjectHandle)
	) as NativeObjectHandle[];

	return list.flatMap((window) => viewsOfClass(objc, window, className, 0));
}
