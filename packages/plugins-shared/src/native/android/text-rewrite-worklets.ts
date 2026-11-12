import type {
	NativeJavaArgument,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaProxyCall,
	NativeJavaReference,
	NativeJavaValue,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	fits,
	mapThrough,
	normalizeEdit,
	overlapsStretch,
	placement,
	restretchedRange,
	stretches,
	covers,
	type TextEdit,
	type TextRewriteAnchor,
	type TextRewriteEdit,
} from '@unbound-plugins/shared/native/android/text-edits';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

const SHARED_KEY = '__unboundTextRewritesShared';
const MAX_RULES = 256;
const MAX_CHAIN = 4;
const MAX_VIEWS = 512;
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const PLACEHOLDER = '￼';
const RECYCLER_VIEW = 'androidx.recyclerview.widget.RecyclerView';
const MAX_ANCESTOR_DEPTH = 12;
const MAX_CONTENT_RETRIES = 20;
const CONTENT_RETRY_DELAY_MS = 100;
const ALIGN_BOTTOM = 0;
const ALIGN_CENTER = 2;
const VISIBLE = 0;
const GONE = 8;
const EXACTLY = 1 << 30;
const SIZE_MASK = (1 << 30) - 1;

export type TextRewriteConfig = {
	/** The UI-runtime global this connection keeps its state under. */
	stateKey: string;
	/** The text view class whose text is rewritten. */
	watchedClass: string;
	/** The plugin's name, for logs. */
	label: string;
};

type Rule = { rendered: string; edits: TextEdit[] };

type Slot = { host: NativeJavaValue; anchor: TextRewriteAnchor };

type Group = { id: string; rendered: string; slots: Slot[]; owner?: string };

type ViewEntry = {
	view: NativeJavaValue;
	shown?: string[];
	listening: boolean;
	retries: number;
};

type Stage = { rendered: string; edits: TextEdit[] };

type Shared = {
	rendered: Map<string, number>;
	originals: Map<string, NativeJavaValue>;
	chains: Map<string, Stage[]>;
};

type State = {
	config: TextRewriteConfig;
	scope: NativeUIScope;
	java: NativeJavaBridge;
	rules: Map<string, Rule>;
	rendered: Set<string>;
	images: Map<string, NativeJavaValue>;
	groups: Map<string, Group[]>;
	groupsById: Map<string, Group>;
	views: Map<string, ViewEntry>;
	pendingShow: Set<string>;
	pendingLayout: Set<string>;
	settleQueue: Set<string>;
	retryQueue: Set<string>;
	observers: Map<string, NativeJavaReference>;
	proxies: Record<'preDraw' | 'attach' | 'layout' | 'settle' | 'retry', NativeJavaReference>;
	objectClass: NativeJavaReference;
	needsHost: NativeUICallback<[string]>;
};

type SetTextEvent = { self?: NativeJavaValue; args: NativeJavaValue[] };

function holder(): Record<string, unknown> {
	'worklet';

	return globalThis as unknown as Record<string, unknown>;
}

function stateOf(stateKey: string): State | undefined {
	'worklet';

	return holder()[stateKey] as State | undefined;
}

function shared(): Shared {
	'worklet';
	const global = holder();

	global[SHARED_KEY] ??= { rendered: new Map(), originals: new Map(), chains: new Map() };

	return global[SHARED_KEY] as Shared;
}

function keyOf(
	value: NativeJavaReference | NativeJavaValue | null | undefined,
): string | undefined {
	'worklet';
	const tagged = value as { type?: unknown; value?: unknown } | null | undefined;

	return tagged?.type === 'handle' && typeof tagged.value === 'string' ? tagged.value : undefined;
}

function nothing(className: string): NativeJavaValue {
	'worklet';

	return { type: 'null', class: className };
}

function exactly(size: number): NativeJavaValue {
	'worklet';

	return javaInt((Math.max(0, Math.round(size)) & SIZE_MASK) | EXACTLY);
}

function textOf(java: NativeJavaBridge, value: NativeJavaArgument): string | undefined {
	'worklet';
	const text = javaText(value as unknown as NativeJavaValue);

	if (text !== undefined) return text;

	const reference = javaReference(value as unknown as NativeJavaValue);

	return reference ? javaText(java.invoke(reference, 'toString', [])) : undefined;
}

function invokeNumber(
	java: NativeJavaBridge,
	target: NativeJavaReference,
	name: string,
	args: NativeJavaArgument[] = [],
) {
	'worklet';

	return javaNumber(java.invoke(target, name, args)) ?? 0;
}

function viewReference(state: State, key: string): NativeJavaReference | null {
	'worklet';

	return javaReference(state.views.get(key)?.view);
}

function isAttached(state: State, key: string | undefined): boolean {
	'worklet';
	const view = key ? viewReference(state, key) : null;

	return view ? javaFlag(state.java.invoke(view, 'isAttachedToWindow', [])) : false;
}

function classNames(java: NativeJavaBridge, value: NativeJavaReference): string[] {
	'worklet';
	const names: string[] = [];
	let current = javaReference(java.invoke(value, 'getClass', []));

	while (current && names.length < 16) {
		const name = javaText(java.invoke(current, 'getName', []));

		if (name) names.push(name);

		current = javaReference(java.invoke(current, 'getSuperclass', []));
	}

	return names;
}

function isRecycler(state: State, view: NativeJavaReference): boolean {
	'worklet';

	return classNames(state.java, view).includes(RECYCLER_VIEW);
}

function rememberView(state: State, key: string, view: NativeJavaValue): ViewEntry {
	'worklet';
	const existing = state.views.get(key);

	if (existing) {
		state.views.delete(key);
		state.views.set(key, existing);

		return existing;
	}

	const entry: ViewEntry = { view, listening: false, retries: 0 };

	state.views.set(key, entry);

	if (state.views.size > MAX_VIEWS) {
		const oldest = state.views.keys().next().value;

		if (oldest !== undefined) forgetView(state, oldest);
	}

	return entry;
}

function forgetView(state: State, key: string) {
	'worklet';

	for (const group of state.groupsById.values()) {
		if (group.owner === key) release(state, group);
	}

	state.views.delete(key);
	state.pendingShow.delete(key);
	state.pendingLayout.delete(key);
	state.settleQueue.delete(key);
	state.retryQueue.delete(key);
}

function clearSpans(
	java: NativeJavaBridge,
	builder: NativeJavaReference,
	state: State,
	from: number,
	to: number,
) {
	'worklet';

	if (from < 0 || to <= from) return;

	const spans = java.invoke(builder, 'getSpans', [javaInt(from), javaInt(to), state.objectClass]);

	for (const span of spans.type === 'array' ? spans.value : []) {
		const reference = javaReference(span as NativeJavaValue);

		if (!reference) continue;

		const start = invokeNumber(java, builder, 'getSpanStart', [reference]);
		const end = invokeNumber(java, builder, 'getSpanEnd', [reference]);

		if (start >= from && end <= to) java.invoke(builder, 'removeSpan', [reference]);
	}
}

type Stretched = { span: NativeJavaReference; flags: number; stretch: boolean };

function stretchedSpans(state: State, builder: NativeJavaReference, edit: TextEdit): Stretched[] {
	'worklet';

	if (!stretches(edit)) return [];

	const java = state.java;
	const spans = java.invoke(builder, 'getSpans', [
		javaInt(edit.stretchFrom),
		javaInt(edit.stretchTo),
		state.objectClass,
	]);
	const stretched: Stretched[] = [];

	for (const span of spans.type === 'array' ? spans.value : []) {
		const reference = javaReference(span as NativeJavaValue);

		if (!reference) continue;

		const start = invokeNumber(java, builder, 'getSpanStart', [reference]);
		const end = invokeNumber(java, builder, 'getSpanEnd', [reference]);

		if (!overlapsStretch(start, end, edit)) continue;

		const named = classNames(java, reference).some((name) =>
			edit.stretchClasses.includes(name),
		);

		stretched.push({
			span: reference,
			flags: invokeNumber(java, builder, 'getSpanFlags', [reference]),
			stretch: named || covers(start, end, edit),
		});
	}

	return stretched;
}

function restretch(
	java: NativeJavaBridge,
	builder: NativeJavaReference,
	edit: TextEdit,
	spans: Stretched[],
) {
	'worklet';

	for (const entry of spans) {
		const range = restretchedRange(
			entry.stretch,
			invokeNumber(java, builder, 'getSpanStart', [entry.span]),
			invokeNumber(java, builder, 'getSpanEnd', [entry.span]),
			edit,
		);

		java.invoke(builder, 'removeSpan', [entry.span]);

		if (range) {
			java.invoke(builder, 'setSpan', [
				entry.span,
				javaInt(range[0]),
				javaInt(range[1]),
				javaInt(entry.flags),
			]);
		}
	}
}

function insertImage(
	state: State,
	builder: NativeJavaReference,
	edit: TextEdit,
	length: number,
): boolean {
	'worklet';
	const java = state.java;
	const bitmap = edit.imageKey ? state.images.get(edit.imageKey) : undefined;
	const index = edit.start + edit.imageOffset;

	if (!bitmap || index < 0 || index >= length) return false;

	const drawable = java.construct('android.graphics.drawable.BitmapDrawable', [
		nothing('android.content.res.Resources'),
		bitmap,
	]);

	java.invoke(drawable, 'setBounds', [
		javaInt(0),
		javaInt(0),
		javaInt(edit.imageSize),
		javaInt(edit.imageSize),
	]);
	java.invoke(builder, 'setSpan', [
		java.construct('android.text.style.ImageSpan', [drawable, javaInt(ALIGN_CENTER)]),
		javaInt(index),
		javaInt(index + 1),
		javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
	]);

	return true;
}

function addSpacer(java: NativeJavaBridge, builder: NativeJavaReference, edit: TextEdit) {
	'worklet';
	const spacer = edit.start + edit.spacerOffset;
	const text = textOf(java, builder) ?? '';

	if (edit.spacerOffset < 0 || spacer >= text.length || text[spacer] !== PLACEHOLDER) return;

	const drawable = java.construct('android.graphics.drawable.ColorDrawable', [javaInt(0)]);

	java.invoke(drawable, 'setBounds', [
		javaInt(0),
		javaInt(0),
		javaInt(edit.width),
		javaInt(edit.height),
	]);
	java.invoke(builder, 'setSpan', [
		java.construct('android.text.style.ImageSpan', [drawable, javaInt(ALIGN_BOTTOM)]),
		javaInt(spacer),
		javaInt(spacer + 1),
		javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
	]);

	if (edit.collapseNext && spacer + 2 <= text.length && text[spacer + 1] === '\n') {
		java.invoke(builder, 'setSpan', [
			java.construct('android.text.style.AbsoluteSizeSpan', [javaInt(1)]),
			javaInt(spacer + 1),
			javaInt(spacer + 2),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);
	}
}

function apply(state: State, text: NativeJavaArgument, rule: Rule): NativeJavaArgument | null {
	'worklet';
	const java = state.java;
	const builder = java.construct('android.text.SpannableStringBuilder', [text]);

	for (const edit of rule.edits) {
		const length = invokeNumber(java, builder, 'length');

		if (!fits(edit, length)) return null;

		clearSpans(java, builder, state, edit.clearFrom, edit.clearTo);

		const stretched = stretchedSpans(state, builder, edit);

		java.invoke(builder, 'replace', [
			javaInt(edit.start),
			javaInt(edit.end),
			{ type: 'string', value: edit.text },
		]);

		if (
			edit.imageKey &&
			!insertImage(state, builder, edit, invokeNumber(java, builder, 'length'))
		) {
			return null;
		}

		if (stretched.length) restretch(java, builder, edit, stretched);

		addSpacer(java, builder, edit);
	}

	return textOf(java, builder) === rule.rendered ? builder : null;
}

function rewrite(
	state: State,
	key: string,
	view: NativeJavaValue,
	text: NativeJavaValue,
): NativeJavaArgument | undefined {
	'worklet';
	const common = shared();
	const incoming = textOf(state.java, text);

	if (incoming === undefined) return undefined;

	if (!common.rendered.has(incoming)) {
		common.originals.set(key, text);
		common.chains.set(key, []);
	}

	const chain = common.chains.get(key) ?? [];
	const stages = [incoming];
	let current: NativeJavaArgument = text;
	let currentText = incoming;

	for (let step = 0; step < MAX_CHAIN; step++) {
		const rule = state.rules.get(currentText);
		const next: NativeJavaArgument | null = rule ? apply(state, current, rule) : null;

		if (!rule || !next) break;

		current = next;
		currentText = rule.rendered;
		stages.push(currentText);
		chain.push({ rendered: rule.rendered, edits: rule.edits });
	}

	common.chains.set(key, chain);

	const entry = rememberView(state, key, view);

	entry.shown = stages;
	showBeforeNextDraw(state, key);

	if (current === text) return undefined;

	settleLayout(state, key);

	return current;
}

function observe(state: State, key: string) {
	'worklet';
	const view = viewReference(state, key);
	const observer = view
		? javaReference(state.java.invoke(view, 'getViewTreeObserver', []))
		: null;

	if (!observer || !javaFlag(state.java.invoke(observer, 'isAlive', []))) return false;

	const observerKey = keyOf(observer);

	if (observerKey && !state.observers.has(observerKey)) {
		state.java.invoke(observer, 'addOnPreDrawListener', [state.proxies.preDraw]);
		state.observers.set(observerKey, observer);
	}

	return true;
}

function showBeforeNextDraw(state: State, key: string) {
	'worklet';

	if (!state.pendingShow.has(key) && observe(state, key)) state.pendingShow.add(key);
}

function schedulePosition(state: State, key: string) {
	'worklet';

	if (state.pendingLayout.has(key) || !observe(state, key)) return;

	state.pendingLayout.add(key);

	const view = viewReference(state, key);

	if (view) state.java.invoke(view, 'invalidate', []);
}

function settleLayout(state: State, key: string) {
	'worklet';
	const view = viewReference(state, key);

	if (!view || state.settleQueue.has(key)) return;

	state.settleQueue.add(key);
	state.java.invoke(view, 'post', [state.proxies.settle]);
}

function outermostList(state: State, view: NativeJavaReference): NativeJavaReference | null {
	'worklet';
	let current = javaReference(state.java.invoke(view, 'getParent', []));
	let outer: NativeJavaReference | null = null;

	for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && current; depth++) {
		if (isRecycler(state, current)) outer = current;

		current = javaReference(state.java.invoke(current, 'getParent', []));
	}

	return outer;
}

function settle(state: State, key: string) {
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

	if (!group.owner || !isAttached(state, group.owner)) return true;

	return !state.views.get(group.owner)?.shown?.includes(group.rendered);
}

function setVisibility(java: NativeJavaBridge, host: NativeJavaValue, visibility: number) {
	'worklet';
	const reference = javaReference(host);

	if (reference && invokeNumber(java, reference, 'getVisibility') !== visibility) {
		java.invoke(reference, 'setVisibility', [javaInt(visibility)]);
	}
}

function release(state: State, group: Group) {
	'worklet';
	group.owner = undefined;

	for (const slot of group.slots) setVisibility(state.java, slot.host, GONE);
}

function container(state: State, view: NativeJavaReference): NativeJavaReference | null {
	'worklet';
	let current = view;

	for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth++) {
		const parent = javaReference(state.java.invoke(current, 'getParent', []));

		if (!parent || !classNames(state.java, parent).includes('android.view.ViewGroup'))
			return null;

		if (!isRecycler(state, parent)) return parent;

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

		if (!host || keyOf(current) === keyOf(parent)) continue;

		if (current) java.invoke(current, 'removeView', [host]);

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

function onTextShown(state: State, key: string) {
	'worklet';
	const stages = state.views.get(key)?.shown ?? [];
	const owned = [...state.groupsById.values()].filter((group) => group.owner === key);
	const wanted = stages.filter((stage) => state.rendered.has(stage));

	for (const group of owned) {
		if (!stages.includes(group.rendered)) release(state, group);
	}

	if (wanted.length) listen(state, key);

	for (const rendered of wanted) {
		if (owned.some((group) => group.rendered === rendered)) continue;

		const candidates = state.groups.get(rendered) ?? [];
		const free = candidates.find((group) => isFree(state, group));

		if (free) {
			attach(state, free, key);
		} else if (candidates.length) {
			state.needsHost(rendered);
		}
	}

	if (owned.some((group) => stages.includes(group.rendered)) || wanted.length)
		schedulePosition(state, key);
}

function claimFor(state: State, rendered: string) {
	'worklet';

	for (const [key, entry] of state.views) {
		if (!entry.shown?.includes(rendered)) continue;

		const groups = state.groups.get(rendered) ?? [];

		if (groups.some((group) => group.owner === key)) {
			schedulePosition(state, key);
			continue;
		}

		const free = groups.find((group) => isFree(state, group));

		if (free) attach(state, free, key);
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

	if (!view || !host || !layout || !parent) return false;

	const offset = later.reduce(
		(position, edits) => mapThrough(position, edits),
		slot.anchor.placeholder,
	);
	const text = textOf(java, java.invoke(view, 'getText', [])) ?? '';

	if (offset >= text.length) return false;

	let x = 0;
	let y = 0;
	let current: NativeJavaReference | null = view;

	for (let depth = 0; current && keyOf(current) !== keyOf(parent); depth++) {
		if (depth >= MAX_ANCESTOR_DEPTH) return false;

		x += invokeNumber(java, current, 'getLeft') - invokeNumber(java, current, 'getScrollX');
		y += invokeNumber(java, current, 'getTop') - invokeNumber(java, current, 'getScrollY');
		current = javaReference(java.invoke(current, 'getParent', []));
	}

	if (!current) return false;

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

		if (!child) continue;

		if (invokeNumber(java, child, 'getChildCount') === 0) java.invoke(child, 'forceLayout', []);

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

	if (!reference || !content || !classNames(java, content).includes('android.view.ViewGroup'))
		return false;

	return (
		javaFlag(java.invoke(reference, 'isAttachedToWindow', [])) &&
		invokeNumber(java, content, 'getChildCount') === 0
	);
}

function positionAll(state: State, key: string) {
	'worklet';
	const entry = state.views.get(key);

	if (!entry) return;

	let empty = false;

	for (const group of state.groupsById.values()) {
		if (group.owner !== key || !entry.shown?.includes(group.rendered)) continue;

		const later = laterEdits(key, group.rendered);

		for (const slot of group.slots) {
			if (position(state, key, slot, later)) setVisibility(state.java, slot.host, VISIBLE);

			empty = empty || hasEmptyContent(state, slot.host);
		}
	}

	if (!empty) {
		entry.retries = 0;

		return;
	}

	entry.retries += 1;

	const view = viewReference(state, key);

	if (entry.retries <= MAX_CONTENT_RETRIES && view && !state.retryQueue.has(key)) {
		state.retryQueue.add(key);
		state.java.invoke(view, 'postDelayed', [
			state.proxies.retry,
			{ type: 'long', value: CONTENT_RETRY_DELAY_MS },
		]);
	}
}

function guarded(state: State, what: string, work: () => void) {
	'worklet';

	try {
		work();
	} catch (error) {
		console.error(`[${state.config.label}] Failed to ${what}: ${String(error)}`);
	}
}

function onPreDraw(stateKey: string): NativeJavaArgument {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) return { type: 'boolean', value: true };

	const show = [...state.pendingShow];
	const layout = [...state.pendingLayout];

	state.pendingShow.clear();
	state.pendingLayout.clear();

	for (const reference of state.observers.values()) {
		if (reference && javaFlag(state.java.invoke(reference, 'isAlive', []))) {
			state.java.invoke(reference, 'removeOnPreDrawListener', [state.proxies.preDraw]);
		}
	}

	state.observers.clear();

	for (const key of show) {
		guarded(state, 'show a rewritten text', () => {
			if (!isAttached(state, key)) return;

			onTextShown(state, key);
			positionAll(state, key);
		});
	}

	for (const key of layout) {
		if (!show.includes(key))
			guarded(state, 'position text hosts', () => positionAll(state, key));
	}

	return { type: 'boolean', value: true };
}

function onAttachChange(stateKey: string, call: NativeJavaProxyCall) {
	'worklet';
	const state = stateOf(stateKey);
	const key = keyOf(call.args[0]);

	if (!state || !key) return;

	if (call.method === 'onViewAttachedToWindow') {
		if (state.views.get(key)?.shown) showBeforeNextDraw(state, key);

		return;
	}

	for (const group of state.groupsById.values()) {
		if (group.owner === key) release(state, group);
	}
}

function onLayoutChange(stateKey: string, call: NativeJavaProxyCall) {
	'worklet';
	const state = stateOf(stateKey);
	const key = keyOf(call.args[0]);
	const [, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom] = call.args.map(
		(value) => javaNumber(value),
	);

	if (!state || !key) return;

	if (left !== oldLeft || top !== oldTop || right !== oldRight || bottom !== oldBottom) {
		guarded(state, 'position text hosts', () => positionAll(state, key));
	}
}

function runQueue(stateKey: string, queue: 'settleQueue' | 'retryQueue') {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) return;

	const keys = [...state[queue]];

	state[queue].clear();

	for (const key of keys) {
		guarded(
			state,
			queue === 'settleQueue' ? 'settle a rewritten row' : 'retry text hosts',
			() => {
				if (queue === 'settleQueue') {
					settle(state, key);
				} else if (isAttached(state, key)) {
					positionAll(state, key);
				}
			},
		);
	}
}

/**
 * @description Installs a plugin's text rewrites on the UI runtime: a hook that rewrites the watched view's text while Discord sets it, and the listeners that show, move and hide the plugin's host views before each frame.
 * @param scope The plugin's UI scope.
 * @param config The state key, the watched text view class, and the plugin's name.
 * @param needsHost Tells the JS thread a shown text has no free group of host views.
 */
export function installTextRewrites(
	scope: NativeUIScope,
	config: TextRewriteConfig,
	needsHost: NativeUICallback<[string]>,
) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const key = config.stateKey;
	const proxies = {
		preDraw: hooks.proxy(['android.view.ViewTreeObserver$OnPreDrawListener'], () =>
			onPreDraw(key),
		).object,
		attach: hooks.proxy(['android.view.View$OnAttachStateChangeListener'], (call) =>
			onAttachChange(key, call),
		).object,
		layout: hooks.proxy(['android.view.View$OnLayoutChangeListener'], (call) =>
			onLayoutChange(key, call),
		).object,
		settle: hooks.proxy(['java.lang.Runnable'], () => runQueue(key, 'settleQueue')).object,
		retry: hooks.proxy(['java.lang.Runnable'], () => runQueue(key, 'retryQueue')).object,
	};
	const state: State = {
		config,
		scope,
		java,
		rules: new Map(),
		rendered: new Set(),
		images: new Map(),
		groups: new Map(),
		groupsById: new Map(),
		views: new Map(),
		pendingShow: new Set(),
		pendingLayout: new Set(),
		settleQueue: new Set(),
		retryQueue: new Set(),
		observers: new Map(),
		proxies,
		objectClass: java.getClass('java.lang.Object'),
		needsHost,
	};

	holder()[key] = state;

	hooks.hook(
		config.watchedClass,
		'setText',
		['java.lang.CharSequence', 'android.widget.TextView$BufferType'],
		{ rewriteArguments: true },
		(event: SetTextEvent) => {
			const view = event.self;
			const viewKey = keyOf(view);
			const [text, bufferType] = event.args;

			if (!view || !viewKey || !text || !bufferType) return;

			if (text.type === 'null') {
				shared().originals.delete(viewKey);
				shared().chains.delete(viewKey);

				return;
			}

			try {
				const current = stateOf(key);
				const rewritten = current ? rewrite(current, viewKey, view, text) : undefined;

				return rewritten ? { arguments: [rewritten, bufferType] } : undefined;
			} catch (error) {
				console.error(`[${config.label}] Failed to rewrite a text: ${String(error)}`);

				return undefined;
			}
		},
	);
}

/**
 * @description Adds or replaces a rule that turns one text into its rendered form.
 * @param stateKey The connection's state key.
 * @param original The text Discord sets.
 * @param rendered The text the edits produce.
 * @param edits The edits, applied last to first.
 */
export function putRule(
	stateKey: string,
	original: string,
	rendered: string,
	edits: TextRewriteEdit[],
) {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) return;

	const previous = state.rules.get(original);

	if (previous) unshare(state, previous.rendered);

	state.rules.delete(original);
	state.rules.set(original, {
		rendered,
		edits: edits.map(normalizeEdit).sort((left, right) => right.start - left.start),
	});
	state.rendered.add(rendered);
	shared().rendered.set(rendered, (shared().rendered.get(rendered) ?? 0) + 1);

	if (state.rules.size > MAX_RULES) {
		const oldest = state.rules.keys().next().value;

		if (oldest !== undefined) removeRule(stateKey, oldest);
	}
}

function unshare(state: State, rendered: string) {
	'worklet';
	const common = shared().rendered;
	const count = (common.get(rendered) ?? 1) - 1;

	state.rendered.delete(rendered);

	if (count > 0) common.set(rendered, count);
	else common.delete(rendered);
}

/**
 * @description Removes a rule.
 * @param stateKey The connection's state key.
 * @param original The text the rule matched.
 */
export function removeRule(stateKey: string, original: string) {
	'worklet';
	const state = stateOf(stateKey);
	const rule = state?.rules.get(original);

	if (!state || !rule) return;

	state.rules.delete(original);
	unshare(state, rule.rendered);
}

/**
 * @description Keeps a bitmap that image edits draw.
 * @param stateKey The connection's state key.
 * @param key The image's key.
 * @param bitmap The bitmap, which the JS thread keeps alive.
 */
export function putImage(stateKey: string, key: string, bitmap: NativeJavaValue) {
	'worklet';
	stateOf(stateKey)?.images.set(key, bitmap);
}

/**
 * @description Forgets a bitmap.
 * @param stateKey The connection's state key.
 * @param key The image's key.
 */
export function removeImage(stateKey: string, key: string) {
	'worklet';
	stateOf(stateKey)?.images.delete(key);
}

/**
 * @description Adds a host view to a group shown wherever its rendered text is.
 * @param stateKey The connection's state key.
 * @param groupId The group.
 * @param rendered The rendered text the group belongs to.
 * @param host The host view, which the JS thread keeps alive.
 * @param anchor Where the host sits relative to its placeholder.
 */
export function addHost(
	stateKey: string,
	groupId: string,
	rendered: string,
	host: NativeJavaValue,
	anchor: TextRewriteAnchor,
) {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) return;

	let group = state.groupsById.get(groupId);

	if (!group) {
		group = { id: groupId, rendered, slots: [] };
		state.groupsById.set(groupId, group);
		state.groups.set(rendered, [...(state.groups.get(rendered) ?? []), group]);
	}

	group.slots.push({ host, anchor });
	guarded(state, 'claim text hosts', () => claimFor(state, rendered));
}

/**
 * @description Moves a host to a new anchor.
 * @param stateKey The connection's state key.
 * @param host The host view.
 * @param anchor Where it now sits.
 */
export function updateAnchor(stateKey: string, host: NativeJavaValue, anchor: TextRewriteAnchor) {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) return;

	for (const group of state.groupsById.values()) {
		const slot = group.slots.find((each) => keyOf(each.host) === keyOf(host));

		if (!slot) continue;

		slot.anchor = anchor;

		if (group.owner) schedulePosition(state, group.owner);

		return;
	}
}

/**
 * @description Removes a group and detaches its hosts.
 * @param stateKey The connection's state key.
 * @param groupId The group.
 */
export function removeGroup(stateKey: string, groupId: string) {
	'worklet';
	const state = stateOf(stateKey);
	const group = state?.groupsById.get(groupId);

	if (!state || !group) return;

	state.groupsById.delete(groupId);
	state.groups.set(
		group.rendered,
		(state.groups.get(group.rendered) ?? []).filter((each) => each.id !== groupId),
	);

	for (const slot of group.slots) {
		const host = javaReference(slot.host);
		const parent = host ? javaReference(state.java.invoke(host, 'getParent', [])) : null;

		setVisibility(state.java, slot.host, GONE);

		if (host && parent) state.java.invoke(parent, 'removeView', [host]);
	}
}

/**
 * @description Sets a text view's original text again, so the rules apply to it afresh.
 * @param stateKey The connection's state key.
 * @param view The text view.
 */
export function reapply(stateKey: string, view: NativeJavaValue) {
	'worklet';
	const state = stateOf(stateKey);
	const key = keyOf(view);
	const reference = javaReference(view);

	if (!state || !key || !reference) return;

	const original = shared().originals.get(key) ?? state.java.invoke(reference, 'getText', []);
	const spannable = state.java.getField(
		state.java.getClass('android.widget.TextView$BufferType'),
		'SPANNABLE',
	);

	guarded(state, 'reapply a text', () => {
		state.java.invoke(reference, 'setText', [original, spannable]);
		settleLayout(state, key);
	});
}

/**
 * @description Reapplies the rules to every view showing a rendered text, or to every rewritten view.
 * @param stateKey The connection's state key.
 * @param rendered The rendered text, or `undefined` for every view.
 */
export function refresh(stateKey: string, rendered?: string) {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) return;

	for (const entry of [...state.views.values()]) {
		if (rendered === undefined || entry.shown?.includes(rendered))
			reapply(stateKey, entry.view);
	}
}

/**
 * @description Removes a connection's rules and sets each rewritten view's original text back, then detaches its hosts and listeners and disposes its UI scope.
 * @param stateKey The connection's state key.
 */
export function disposeTextRewrites(stateKey: string) {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) return;

	for (const rendered of [...state.rendered]) unshare(state, rendered);

	state.rules.clear();
	refresh(stateKey);

	for (const groupId of [...state.groupsById.keys()]) removeGroup(stateKey, groupId);

	for (const reference of state.observers.values()) {
		if (reference && javaFlag(state.java.invoke(reference, 'isAlive', []))) {
			state.java.invoke(reference, 'removeOnPreDrawListener', [state.proxies.preDraw]);
		}
	}

	for (const entry of state.views.values()) {
		const view = javaReference(entry.view);

		if (!view || !entry.listening) continue;

		state.java.invoke(view, 'removeOnAttachStateChangeListener', [state.proxies.attach]);
		state.java.invoke(view, 'removeOnLayoutChangeListener', [state.proxies.layout]);
	}

	delete holder()[stateKey];
	state.scope.dispose();
}
