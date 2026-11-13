import {
	classNames,
	exactly,
	GONE,
	invokeNumber,
	isAttached,
	isRecycler,
	keyOf,
	MAX_ANCESTOR_DEPTH,
	release,
	setVisibility,
	shared,
	textOf,
	viewReference,
	VISIBLE,
	type Group,
	type Slot,
	type State,
} from '@unbound-plugins/shared/native/android/text-rewrite-state';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	mapThrough,
	placement,
	type TextEdit,
} from '@unbound-plugins/shared/native/android/text-edits';
import type { NativeJavaReference, NativeJavaValue } from '@unbound-app/api/native';

const MAX_CONTENT_RETRIES = 20;
const CONTENT_RETRY_DELAY_MS = 100;

function observe(state: State, key: string) {
	'worklet';
	const view = viewReference(state, key);
	const observer = view
		? javaReference(state.java.invoke(view, 'getViewTreeObserver', []))
		: null;

	if (!observer || !javaFlag(state.java.invoke(observer, 'isAlive', []))) {
		return false;
	}

	const observerKey = keyOf(observer);

	if (observerKey && !state.observers.has(observerKey)) {
		state.java.invoke(observer, 'addOnPreDrawListener', [state.proxies.preDraw]);
		state.observers.set(observerKey, observer);
	}

	return true;
}

/**
 * @description Shows, moves and hides a view's host groups before its next frame.
 * @param state The connection's state.
 * @param key The text view's key.
 */
export function showBeforeNextDraw(state: State, key: string) {
	'worklet';

	if (!state.pendingShow.has(key) && observe(state, key)) {
		state.pendingShow.add(key);
	}
}

/**
 * @description Relays out a rewritten row and its list after the current frame, so its new height applies at once.
 * @param state The connection's state.
 * @param key The text view's key.
 */
export function settleLayout(state: State, key: string) {
	'worklet';
	const view = viewReference(state, key);

	if (!view || state.settleQueue.has(key)) return;

	state.settleQueue.add(key);
	state.java.invoke(view, 'post', [state.proxies.settle]);
}

/**
 * @description Moves a view's hosts before its next frame.
 * @param state The connection's state.
 * @param key The text view's key.
 */
export function schedulePosition(state: State, key: string) {
	'worklet';

	if (state.pendingLayout.has(key) || !observe(state, key)) return;

	state.pendingLayout.add(key);

	const view = viewReference(state, key);

	if (view) {
		state.java.invoke(view, 'invalidate', []);
	}
}

function outermostList(state: State, view: NativeJavaReference): NativeJavaReference | null {
	'worklet';
	let current = javaReference(state.java.invoke(view, 'getParent', []));
	let outer: NativeJavaReference | null = null;

	for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && current; depth++) {
		if (isRecycler(state, current)) {
			outer = current;
		}

		current = javaReference(state.java.invoke(current, 'getParent', []));
	}

	return outer;
}

/**
 * @description Forces a rewritten row and its outermost list to lay out again now.
 * @param state The connection's state.
 * @param key The text view's key.
 */
export function settle(state: State, key: string) {
	'worklet';
	const java = state.java;
	const view = viewReference(state, key);

	if (!view || !javaFlag(java.invoke(view, 'isAttachedToWindow', []))) return;

	const list = outermostList(state, view);

	if (!list) return;

	let node: NativeJavaReference | null = view;

	for (
		let depth = 0;
		node && depth < MAX_ANCESTOR_DEPTH && keyOf(node) !== keyOf(list);
		depth++
	) {
		java.invoke(node, 'forceLayout', []);
		node = javaReference(java.invoke(node, 'getParent', []));
	}

	java.invoke(list, 'forceLayout', []);
	java.invoke(list, 'measure', [
		exactly(invokeNumber(java, list, 'getWidth')),
		exactly(invokeNumber(java, list, 'getHeight')),
	]);
	java.invoke(list, 'layout', [
		javaInt(invokeNumber(java, list, 'getLeft')),
		javaInt(invokeNumber(java, list, 'getTop')),
		javaInt(invokeNumber(java, list, 'getRight')),
		javaInt(invokeNumber(java, list, 'getBottom')),
	]);
}

function listen(state: State, key: string) {
	'worklet';
	const entry = state.views.get(key);
	const view = viewReference(state, key);

	if (!entry || !view || entry.listening) return;

	entry.listening = true;
	state.java.invoke(view, 'addOnAttachStateChangeListener', [state.proxies.attach]);
	state.java.invoke(view, 'addOnLayoutChangeListener', [state.proxies.layout]);
}

function isFree(state: State, group: Group): boolean {
	'worklet';

	if (!group.owner || !isAttached(state, group.owner)) {
		return true;
	}

	return !state.views.get(group.owner)?.shown?.includes(group.rendered);
}

function container(state: State, view: NativeJavaReference): NativeJavaReference | null {
	'worklet';
	let current = view;

	for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth++) {
		const parent = javaReference(state.java.invoke(current, 'getParent', []));

		if (!parent || !classNames(state.java, parent).includes('android.view.ViewGroup'))
			return null;

		if (!isRecycler(state, parent)) {
			return parent;
		}

		current = parent;
	}

	return null;
}

function attach(state: State, group: Group, key: string) {
	'worklet';
	const java = state.java;
	const view = viewReference(state, key);

	group.owner = key;

	for (const slot of group.slots) setVisibility(java, slot.host, GONE);

	const parent = view ? container(state, view) : null;

	if (!parent) return;

	for (const slot of group.slots) {
		const host = javaReference(slot.host);
		const current = host ? javaReference(java.invoke(host, 'getParent', [])) : null;

		if (!host || keyOf(current) === keyOf(parent)) {
			continue;
		}

		if (current) {
			java.invoke(current, 'removeView', [host]);
		}

		java.invoke(parent, 'addView', [
			host,
			java.construct('android.view.ViewGroup$LayoutParams', [
				javaInt(slot.anchor.width),
				javaInt(slot.anchor.height),
			]),
		]);
	}

	schedulePosition(state, key);
}

/**
 * @description Gives a view the host groups of the rendered texts it shows, and frees the ones it no longer shows.
 * @param state The connection's state.
 * @param key The text view's key.
 */
export function onTextShown(state: State, key: string) {
	'worklet';
	const stages = state.views.get(key)?.shown ?? [];
	const owned = [...state.groupsById.values()].filter((group) => group.owner === key);
	const wanted = stages.filter((stage) => state.rendered.has(stage));

	for (const group of owned) {
		if (!stages.includes(group.rendered)) {
			release(state, group);
		}
	}

	if (wanted.length) {
		listen(state, key);
	}

	for (const rendered of wanted) {
		if (owned.some((group) => group.rendered === rendered)) {
			continue;
		}

		const candidates = state.groups.get(rendered) ?? [];
		const free = candidates.find((group) => isFree(state, group));

		if (free) {
			attach(state, free, key);
		} else if (candidates.length) {
			state.needsHost(rendered);
		}
	}

	if (owned.some((group) => stages.includes(group.rendered)) || wanted.length) {
		schedulePosition(state, key);
	}
}

/**
 * @description Gives free host groups of a rendered text to the views showing it.
 * @param state The connection's state.
 * @param rendered The rendered text.
 */
export function claimFor(state: State, rendered: string) {
	'worklet';

	for (const [key, entry] of state.views) {
		if (!entry.shown?.includes(rendered)) {
			continue;
		}

		const groups = state.groups.get(rendered) ?? [];

		if (groups.some((group) => group.owner === key)) {
			schedulePosition(state, key);
			continue;
		}

		const free = groups.find((group) => isFree(state, group));

		if (free) {
			attach(state, free, key);
		}
	}
}

function laterEdits(key: string, rendered: string): TextEdit[][] {
	'worklet';
	const chain = shared().chains.get(key) ?? [];
	const stage = chain.findIndex((entry) => entry.rendered === rendered);

	return stage < 0 ? [] : chain.slice(stage + 1).map((entry) => entry.edits);
}

function position(state: State, key: string, slot: Slot, later: TextEdit[][]): boolean {
	'worklet';
	const java = state.java;
	const view = viewReference(state, key);
	const host = javaReference(slot.host);
	const layout = view ? javaReference(java.invoke(view, 'getLayout', [])) : null;
	const parent = host ? javaReference(java.invoke(host, 'getParent', [])) : null;

	if (!view || !host || !layout || !parent) {
		return false;
	}

	const offset = later.reduce(
		(position, edits) => mapThrough(position, edits),
		slot.anchor.placeholder,
	);
	const text = textOf(java, java.invoke(view, 'getText', [])) ?? '';

	if (offset >= text.length) {
		return false;
	}

	let x = 0;
	let y = 0;
	let current: NativeJavaReference | null = view;

	for (let depth = 0; current && keyOf(current) !== keyOf(parent); depth++) {
		if (depth >= MAX_ANCESTOR_DEPTH) {
			return false;
		}

		x += invokeNumber(java, current, 'getLeft') - invokeNumber(java, current, 'getScrollX');
		y += invokeNumber(java, current, 'getTop') - invokeNumber(java, current, 'getScrollY');
		current = javaReference(java.invoke(current, 'getParent', []));
	}

	if (!current) {
		return false;
	}

	const line = invokeNumber(java, layout, 'getLineForOffset', [javaInt(offset)]);
	const place = placement(
		{ ...slot.anchor, placeholder: offset },
		{ x, y },
		invokeNumber(java, layout, 'getPrimaryHorizontal', [javaInt(offset)]),
		invokeNumber(java, layout, 'getLineTop', [javaInt(line)]),
		invokeNumber(java, layout, 'getLineBottom', [javaInt(line)]),
		{
			x: invokeNumber(java, view, 'getTotalPaddingLeft'),
			y: invokeNumber(java, view, 'getTotalPaddingTop'),
		},
	);
	const { width, height } = slot.anchor;

	java.invoke(host, 'setTranslationX', [javaFloat(place.x)]);
	java.invoke(host, 'setTranslationY', [javaFloat(place.y)]);

	const params = javaReference(java.invoke(host, 'getLayoutParams', []));

	if (
		params &&
		(javaNumber(java.getField(params, 'width')) !== width ||
			javaNumber(java.getField(params, 'height')) !== height)
	) {
		java.setField(params, 'width', javaInt(width));
		java.setField(params, 'height', javaInt(height));
		java.invoke(host, 'setLayoutParams', [params]);
	}

	java.invoke(host, 'measure', [exactly(width), exactly(height)]);
	java.invoke(host, 'layout', [javaInt(0), javaInt(0), javaInt(width), javaInt(height)]);

	const children = invokeNumber(java, host, 'getChildCount');

	for (let index = 0; index < children; index++) {
		const child = javaReference(java.invoke(host, 'getChildAt', [javaInt(index)]));

		if (!child) {
			continue;
		}

		if (invokeNumber(java, child, 'getChildCount') === 0) {
			java.invoke(child, 'forceLayout', []);
		}

		java.invoke(child, 'measure', [exactly(width), exactly(height)]);
		java.invoke(child, 'layout', [javaInt(0), javaInt(0), javaInt(width), javaInt(height)]);
	}

	return true;
}

function hasEmptyContent(state: State, host: NativeJavaValue): boolean {
	'worklet';
	const java = state.java;
	const reference = javaReference(host);
	const content = reference
		? javaReference(java.invoke(reference, 'getChildAt', [javaInt(0)]))
		: null;

	if (!reference || !content || !classNames(java, content).includes('android.view.ViewGroup')) {
		return false;
	}

	return (
		javaFlag(java.invoke(reference, 'isAttachedToWindow', [])) &&
		invokeNumber(java, content, 'getChildCount') === 0
	);
}

/**
 * @description Moves and shows the hosts a view owns, and retries later while a host's content is still empty.
 * @param state The connection's state.
 * @param key The text view's key.
 */
export function positionAll(state: State, key: string) {
	'worklet';
	const entry = state.views.get(key);

	if (!entry) return;

	let empty = false;

	for (const group of state.groupsById.values()) {
		if (group.owner !== key || !entry.shown?.includes(group.rendered)) {
			continue;
		}

		const later = laterEdits(key, group.rendered);

		for (const slot of group.slots) {
			if (position(state, key, slot, later)) {
				setVisibility(state.java, slot.host, VISIBLE);
			}

			empty ||= hasEmptyContent(state, slot.host);
		}
	}

	if (!empty) {
		entry.retries = 0;

		return;
	}

	entry.retries += 1;

	const view = viewReference(state, key);

	if (!(entry.retries <= MAX_CONTENT_RETRIES && view && !state.retryQueue.has(key))) {
		return;
	}

	state.retryQueue.add(key);
	state.java.invoke(view, 'postDelayed', [
		state.proxies.retry,
		{ type: 'long', value: CONTENT_RETRY_DELAY_MS },
	]);
}
