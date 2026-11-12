import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	javaFloat,
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';

const STATE_KEY = '__unboundChatBubblesBlur';
/** How many ancestors of the chat list are searched for the chat background's image. */
const SEARCH_DEPTH = 16;
/** The largest radius RenderScript blurs by, in pixels. */
const MAX_RADIUS = 25;
/** The least the backdrop shrinks by: the blur hides the lost detail, and a small bitmap is cheap to blur and to sample. */
const MIN_FACTOR = 4;
/** How long to wait before looking for a backdrop again after finding none, or one still loading. */
const RETRY_MS = 1000;
/** `View.onScrollChanged`'s parameters, which a list calls after each scroll step. */
const SCROLL_PARAMETERS = ['int', 'int', 'int', 'int'];

type Point = { x: number; y: number };

/** The chat background, blurred and shrunk, and where the chat list sits on it. */
type Backdrop = {
	radius: number;
	factor: number;
	bitmap: NativeJavaReference;
	/** Where the list's top left sits on the backdrop, in pixels. */
	offset: Point;
	height: number;
};

type BlurredRow = {
	row: NativeJavaReference;
	view: NativeJavaReference;
	shader: NativeJavaReference;
	matrix: NativeJavaReference;
	/** The row's left edge in the list, which scrolling leaves alone. */
	x: number;
};

type BlurState = {
	java: NativeJavaBridge;
	list: NativeJavaReference | null;
	backdrop: Backdrop | null;
	/** When the last search found no usable backdrop. */
	missed: number;
	/** Counts the backdrops captured, so a bubble drawn over an older one is drawn again. */
	generation: number;
	rows: Map<string, BlurredRow>;
};

type StateHolder = Record<typeof STATE_KEY, BlurState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function keyOf(view: NativeJavaReference): string {
	'worklet';

	return 'value' in view ? String(view.value) : '';
}

function number(java: NativeJavaBridge, view: NativeJavaReference, name: string): number {
	'worklet';

	return javaNumber(java.invoke(view, name, [])) ?? 0;
}

function parentOf(java: NativeJavaBridge, view: NativeJavaReference) {
	'worklet';

	return javaReference(java.invoke(view, 'getParent', []));
}

// The chat background is an image drawn under the chat, a sibling before the list's ancestor in a frame that covers it.
function findBackdrop(java: NativeJavaBridge, list: NativeJavaReference) {
	'worklet';
	const width = number(java, list, 'getWidth');
	const height = number(java, list, 'getHeight');
	const chain = [list];

	for (let depth = 0; depth < SEARCH_DEPTH; depth++) {
		const child = chain[chain.length - 1]!;
		const parent = parentOf(java, child);

		if (!parent || !javaFlag(java.respondsTo(parent, 'getChildAt', [javaInt(0)]))) return;

		const count = number(java, parent, 'getChildCount');

		for (let index = 0; index < count; index++) {
			const sibling = javaReference(java.invoke(parent, 'getChildAt', [javaInt(index)]));

			if (!sibling || keyOf(sibling) === keyOf(child)) break;

			if (
				javaFlag(java.respondsTo(sibling, 'getImageMatrix', [])) &&
				number(java, sibling, 'getWidth') >= width &&
				number(java, sibling, 'getHeight') >= height
			) {
				return { image: sibling, chain: chain.reverse() };
			}
		}

		chain.push(parent);
	}
}

// The chat colour sits over the image, see-through by the background's opacity, on the views between it and the list.
function drawTint(
	java: NativeJavaBridge,
	canvas: NativeJavaReference,
	chain: NativeJavaReference[],
	image: NativeJavaReference,
): Point {
	'worklet';
	let x = -number(java, image, 'getX');
	let y = -number(java, image, 'getY');

	for (const view of chain) {
		x += number(java, view, 'getX');
		y += number(java, view, 'getY');

		const background = javaReference(java.invoke(view, 'getBackground', []));

		if (!background) continue;

		java.invoke(canvas, 'save', []);
		java.invoke(canvas, 'translate', [javaFloat(x), javaFloat(y)]);
		java.invoke(background, 'draw', [canvas]);
		java.invoke(canvas, 'restore', []);
	}

	return { x, y };
}

function blurBitmap(java: NativeJavaBridge, bitmap: NativeJavaReference, radius: number) {
	'worklet';
	const context = javaReference(
		java.invoke(
			java.getField(
				java.getClass('app.unbound.android.ActivityTracker'),
				'INSTANCE',
			) as NativeJavaReference,
			'currentActivity',
			[],
		),
	);

	if (!context) return;

	const RenderScript = java.getClass('android.renderscript.RenderScript');
	const script = javaReference(java.invoke(RenderScript, 'create', [context]));

	if (!script) return;

	const Allocation = java.getClass('android.renderscript.Allocation');
	const input = javaReference(java.invoke(Allocation, 'createFromBitmap', [script, bitmap]));
	const output =
		input &&
		javaReference(
			java.invoke(Allocation, 'createTyped', [script, java.invoke(input, 'getType', [])]),
		);
	const element = java.invoke(java.getClass('android.renderscript.Element'), 'U8_4', [script]);
	const blur = javaReference(
		java.invoke(java.getClass('android.renderscript.ScriptIntrinsicBlur'), 'create', [
			script,
			element,
		]),
	);

	if (input && output && blur) {
		java.invoke(blur, 'setRadius', [javaFloat(Math.max(0.1, Math.min(MAX_RADIUS, radius)))]);
		java.invoke(blur, 'setInput', [input]);
		java.invoke(blur, 'forEach', [output]);
		java.invoke(output, 'copyTo', [bitmap]);
	}

	java.invoke(script, 'destroy', []);
}

// Draws the chat background, and the chat colour over it, into a small bitmap, and blurs it; `undefined` while the image is still loading.
function captureBackdrop(
	java: NativeJavaBridge,
	list: NativeJavaReference,
	radius: number,
): Backdrop | undefined {
	'worklet';
	const found = findBackdrop(java, list);

	if (!found) return;

	const { image, chain } = found;
	const factor = Math.max(MIN_FACTOR, Math.ceil(radius / MAX_RADIUS));
	const width = Math.ceil(number(java, image, 'getWidth') / factor);
	const height = Math.ceil(number(java, image, 'getHeight') / factor);
	const config = java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888');
	const bitmap = javaReference(
		java.invoke(java.getClass('android.graphics.Bitmap'), 'createBitmap', [
			javaInt(width),
			javaInt(height),
			config,
		]),
	);

	if (!bitmap) return;

	const canvas = java.construct('android.graphics.Canvas', [bitmap]);

	java.invoke(canvas, 'scale', [javaFloat(1 / factor), javaFloat(1 / factor)]);
	java.invoke(image, 'draw', [canvas]);

	// An image still loading draws nothing.
	const middle = javaNumber(
		java.invoke(bitmap, 'getPixel', [javaInt(width >> 1), javaInt(height >> 1)]),
	);

	if (!middle || middle >>> 24 === 0) return;

	const offset = drawTint(java, canvas, chain, image);

	blurBitmap(java, bitmap, radius / factor);

	return { radius, factor, bitmap, offset, height: number(java, list, 'getHeight') };
}

function current(java: NativeJavaBridge): BlurState {
	'worklet';
	const state = holder()[STATE_KEY];

	if (state) return state;

	const created: BlurState = {
		java,
		list: null,
		backdrop: null,
		missed: 0,
		generation: 0,
		rows: new Map(),
	};

	holder()[STATE_KEY] = created;

	return created;
}

// The list's rows move without redrawing; each blur's shader moves the other way so the backdrop stays put. Each scroll
// step runs this for every row on screen, so it makes four calls: scaling about a pivot also moves the shader.
function place(state: BlurState, blurred: BlurredRow) {
	'worklet';
	const { java, backdrop } = state;

	if (!backdrop) return;

	const { factor, offset } = backdrop;
	const y = offset.y + number(java, blurred.row, 'getY');
	const x = offset.x + blurred.x;
	// Scaling by k about p maps s to k * s + p * (1 - k), which is k * s - position when p = position / (k - 1).
	const pivot = (position: number) => javaFloat(position / (factor - 1));

	java.invoke(blurred.matrix, 'setScale', [
		javaFloat(factor),
		javaFloat(factor),
		pivot(x),
		pivot(y),
	]);
	java.invoke(blurred.shader, 'setLocalMatrix', [blurred.matrix]);
	java.invoke(blurred.view, 'invalidate', []);
}

/**
 * @description Blurs the chat background behind a list, again for a new list, radius or list height, and at most once a second while it finds none.
 * @param java The UI scope's Java bridge.
 * @param list The chat list.
 * @param radius The blur radius in pixels.
 * @returns A number that changes with each blurred background, or `undefined` without a chat background, or while its image loads.
 */
export function prepareBlur(
	java: NativeJavaBridge,
	list: NativeJavaReference,
	radius: number,
): number | undefined {
	'worklet';
	const state = current(java);
	const fresh =
		state.backdrop &&
		state.list &&
		keyOf(state.list) === keyOf(list) &&
		state.backdrop.radius === radius &&
		state.backdrop.height === number(java, list, 'getHeight');

	if (fresh) return state.generation;

	if (Date.now() - state.missed < RETRY_MS && state.list && keyOf(state.list) === keyOf(list))
		return;

	state.list = list;
	state.backdrop = captureBackdrop(java, list, radius) ?? null;
	state.rows.clear();

	if (!state.backdrop) {
		state.missed = Date.now();

		return;
	}

	return ++state.generation;
}

/**
 * @description Makes a shader that paints the blurred chat background from `prepareBlur`, for one bubble.
 * @param java The UI scope's Java bridge.
 * @returns The shader, or `undefined` when no background is blurred.
 */
export function blurShader(java: NativeJavaBridge): NativeJavaReference | undefined {
	'worklet';
	const backdrop = current(java).backdrop;

	if (!backdrop) return;

	const clamp = java.getField(java.getClass('android.graphics.Shader$TileMode'), 'CLAMP');

	return java.construct('android.graphics.BitmapShader', [backdrop.bitmap, clamp, clamp]);
}

/**
 * @description Keeps a row's blur lined up with the chat background as the list scrolls, or stops when the row shows no blur.
 * @param java The UI scope's Java bridge.
 * @param row The message row.
 * @param view The view the row's bubble is the background of.
 * @param shader The bubble's blur shader, or `undefined` when it has none.
 */
export function trackBlur(
	java: NativeJavaBridge,
	row: NativeJavaReference,
	view: NativeJavaReference | null,
	shader: NativeJavaReference | undefined,
) {
	'worklet';
	const state = current(java);

	if (!shader || !view) {
		state.rows.delete(keyOf(row));

		return;
	}

	const tracked = state.rows.get(keyOf(row));
	const blurred = {
		row,
		view,
		shader,
		matrix: tracked?.matrix ?? java.construct('android.graphics.Matrix', []),
		x: number(java, row, 'getX'),
	};

	state.rows.set(keyOf(row), blurred);
	place(state, blurred);
}

/**
 * @description Moves every blur with its row each time the chat list scrolls.
 * @param hooks The UI scope's Java hooks bridge.
 * @param java The UI scope's Java bridge.
 */
export function installBlurScroll(hooks: NativeJavaHooksBridge, java: NativeJavaBridge) {
	'worklet';
	// A reloaded plugin gets a new scope, whose bridge replaces the old one.
	holder()[STATE_KEY] = undefined;

	const state = current(java);

	hooks.hook(
		'android.view.View',
		'onScrollChanged',
		SCROLL_PARAMETERS,
		{ notify: 'after', payload: { arguments: [] } },
		(event: { self?: NativeJavaValue }) => {
			const list = javaReference(event.self);

			if (!state.rows.size || !list || !state.list || keyOf(list) !== keyOf(state.list))
				return;

			try {
				for (const blurred of state.rows.values()) place(state, blurred);
			} catch (error) {
				console.error(`[Chat Bubbles] ${String(error)}`);
			}
		},
	);
}

/**
 * @description Forgets the blurred background and every row's blur, when the bubbles stop or their look changes.
 */
export function forgetBlurs() {
	'worklet';
	const state = holder()[STATE_KEY];

	if (!state) return;

	state.backdrop = null;
	state.list = null;
	state.missed = 0;
	state.rows.clear();
}

export default { prepareBlur, blurShader, trackBlur, installBlurScroll, forgetBlurs };
