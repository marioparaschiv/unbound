import type {
	NativeJavaArgument,
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import type {
	TextEdit,
	TextRewriteAnchor,
} from '@unbound-plugins/shared/native/android/text-edits';

const MAX_VIEWS = 512;
const RECYCLER_VIEW = 'androidx.recyclerview.widget.RecyclerView';
const EXACTLY = 1 << 30;
const SIZE_MASK = (1 << 30) - 1;

export const MAX_ANCESTOR_DEPTH = 12;
export const VISIBLE = 0;
export const GONE = 8;

export type TextRewriteConfig = {
	/** The key this connection's state is kept under on the UI runtime. */
	stateKey: string;
	/** The text view class whose text is rewritten. */
	watchedClass: string;
	/** The plugin's name, for logs. */
	label: string;
};

export type Rule = { rendered: string; edits: TextEdit[] };

export type Slot = { host: NativeJavaValue; anchor: TextRewriteAnchor };

export type Group = { id: string; rendered: string; slots: Slot[]; owner?: string };

export type ViewEntry = {
	view: NativeJavaValue;
	shown?: string[];
	listening: boolean;
	retries: number;
};

type Stage = { rendered: string; edits: TextEdit[] };

/** What every plugin's text rewrites share on the UI runtime, so their rules chain on one view. */
export type Shared = {
	rendered: Map<string, number>;
	originals: Map<string, NativeJavaValue>;
	chains: Map<string, Stage[]>;
};

/** One connection's rules, host groups and watched views on the UI runtime. */
export type State = {
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

declare global {
	var __unboundTextRewritesShared: Shared | undefined;
	var __unboundTextRewriteStates: Map<string, State> | undefined;
}

/**
 * @description Reads a connection's state.
 * @param stateKey The connection's state key.
 * @returns The state, or `undefined` once disposed.
 */
export function stateOf(stateKey: string): State | undefined {
	'worklet';

	return globalThis.__unboundTextRewriteStates?.get(stateKey);
}

/**
 * @description Keeps a connection's state, or forgets it.
 * @param stateKey The connection's state key.
 * @param state The state, or `undefined` to forget it.
 */
export function setState(stateKey: string, state: State | undefined) {
	'worklet';
	const states = (globalThis.__unboundTextRewriteStates ??= new Map());

	if (state) {
		states.set(stateKey, state);
	} else {
		states.delete(stateKey);
	}
}

/**
 * @description Reads the state every plugin's text rewrites share.
 * @returns The shared state.
 */
export function shared(): Shared {
	'worklet';

	return (globalThis.__unboundTextRewritesShared ??= {
		rendered: new Map(),
		originals: new Map(),
		chains: new Map(),
	});
}

/**
 * @description Keys a Java object by its handle.
 * @param value The object.
 * @returns The handle's id, or `undefined` when the value is not a handle.
 */
export function keyOf(
	value: NativeJavaReference | NativeJavaValue | null | undefined,
): string | undefined {
	'worklet';
	const tagged = value as { type?: unknown; value?: unknown } | null | undefined;

	return tagged?.type === 'handle' && typeof tagged.value === 'string' ? tagged.value : undefined;
}

/**
 * @description Tags a Java `null` of a class.
 * @param className The class.
 * @returns The tagged value.
 */
export function nothing(className: string): NativeJavaValue {
	'worklet';

	return { type: 'null', class: className };
}

/**
 * @description Makes an exact `View.MeasureSpec`.
 * @param size The size in pixels.
 * @returns The tagged spec.
 */
export function exactly(size: number): NativeJavaValue {
	'worklet';

	return javaInt((Math.max(0, Math.round(size)) & SIZE_MASK) | EXACTLY);
}

function isJavaValue(value: NativeJavaArgument): value is NativeJavaValue {
	'worklet';

	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		typeof value.type === 'string'
	);
}

/**
 * @description Reads a Java value or object as a string, through `toString` for objects.
 * @param java The Java bridge.
 * @param value The value.
 * @returns The string, or `undefined` for Java `null` and non-text values.
 */
export function textOf(java: NativeJavaBridge, value: NativeJavaArgument): string | undefined {
	'worklet';
	const text = isJavaValue(value) ? javaText(value) : undefined;

	if (text !== undefined) {
		return text;
	}

	const reference = isJavaValue(value) ? javaReference(value) : value;

	return reference ? javaText(java.invoke(reference, 'toString', [])) : undefined;
}

/**
 * @description Calls a Java method that returns a number.
 * @param java The Java bridge.
 * @param target The object.
 * @param name The method.
 * @param args The arguments.
 * @returns The number, or `0` when the result is not numeric.
 */
export function invokeNumber(
	java: NativeJavaBridge,
	target: NativeJavaReference,
	name: string,
	args: NativeJavaArgument[] = [],
): number {
	'worklet';

	return javaNumber(java.invoke(target, name, args)) ?? 0;
}

/**
 * @description Reads a watched view's handle.
 * @param state The connection's state.
 * @param key The view's key.
 * @returns The handle, or `null` when the view is not watched.
 */
export function viewReference(state: State, key: string): NativeJavaReference | null {
	'worklet';

	return javaReference(state.views.get(key)?.view);
}

/**
 * @description Tells whether a watched view is attached to a window.
 * @param state The connection's state.
 * @param key The view's key.
 * @returns `true` when it is.
 */
export function isAttached(state: State, key: string | undefined): boolean {
	'worklet';
	const view = key ? viewReference(state, key) : null;

	return view ? javaFlag(state.java.invoke(view, 'isAttachedToWindow', [])) : false;
}

/**
 * @description Lists a Java object's class and superclasses.
 * @param java The Java bridge.
 * @param value The object.
 * @returns The class names, most specific first.
 */
export function classNames(java: NativeJavaBridge, value: NativeJavaReference): string[] {
	'worklet';
	const names: string[] = [];
	let current = javaReference(java.invoke(value, 'getClass', []));

	while (current && names.length < 16) {
		const name = javaText(java.invoke(current, 'getName', []));

		if (name) {
			names.push(name);
		}

		current = javaReference(java.invoke(current, 'getSuperclass', []));
	}

	return names;
}

/**
 * @description Tells whether a view is a `RecyclerView`.
 * @param state The connection's state.
 * @param view The view.
 * @returns `true` when it is.
 */
export function isRecycler(state: State, view: NativeJavaReference): boolean {
	'worklet';

	return classNames(state.java, view).includes(RECYCLER_VIEW);
}

/**
 * @description Sets a view's visibility when it differs.
 * @param java The Java bridge.
 * @param host The view.
 * @param visibility `VISIBLE` or `GONE`.
 */
export function setVisibility(java: NativeJavaBridge, host: NativeJavaValue, visibility: number) {
	'worklet';
	const reference = javaReference(host);

	if (reference && invokeNumber(java, reference, 'getVisibility') !== visibility) {
		java.invoke(reference, 'setVisibility', [javaInt(visibility)]);
	}
}

/**
 * @description Frees a host group from its view and hides its hosts.
 * @param state The connection's state.
 * @param group The group.
 */
export function release(state: State, group: Group) {
	'worklet';
	group.owner = undefined;

	for (const slot of group.slots) setVisibility(state.java, slot.host, GONE);
}

function forgetView(state: State, key: string) {
	'worklet';

	for (const group of state.groupsById.values()) {
		if (group.owner === key) {
			release(state, group);
		}
	}

	state.views.delete(key);
	state.pendingShow.delete(key);
	state.pendingLayout.delete(key);
	state.settleQueue.delete(key);
	state.retryQueue.delete(key);
}

/**
 * @description Watches a view, or marks it most recently used, forgetting the oldest past the limit.
 * @param state The connection's state.
 * @param key The view's key.
 * @param view The view.
 * @returns The view's entry.
 */
export function rememberView(state: State, key: string, view: NativeJavaValue): ViewEntry {
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

		if (oldest !== undefined) {
			forgetView(state, oldest);
		}
	}

	return entry;
}

/**
 * @description Runs work, logging instead of throwing into the hook or listener that called it.
 * @param state The connection's state.
 * @param what What the work does, for the log.
 * @param work The work.
 */
export function guarded(state: State, what: string, work: () => void) {
	'worklet';

	try {
		work();
	} catch (error) {
		console.error(`[${state.config.label}] Failed to ${what}: ${String(error)}`);
	}
}
