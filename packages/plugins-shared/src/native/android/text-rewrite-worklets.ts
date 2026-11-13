import {
	GONE,
	guarded,
	isAttached,
	keyOf,
	release,
	rememberView,
	setState,
	setVisibility,
	shared,
	stateOf,
	textOf,
	type State,
	type TextRewriteConfig,
} from '@unbound-plugins/shared/native/android/text-rewrite-state';
import type {
	NativeJavaArgument,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaProxyCall,
	NativeJavaValue,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	claimFor,
	onTextShown,
	positionAll,
	schedulePosition,
	settle,
	settleLayout,
	showBeforeNextDraw,
} from '@unbound-plugins/shared/native/android/text-rewrite-hosts';
import {
	normalizeEdit,
	type TextRewriteAnchor,
	type TextRewriteEdit,
} from '@unbound-plugins/shared/native/android/text-edits';
import {
	javaFlag,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import { applyRule } from '@unbound-plugins/shared/native/android/text-rewrite-spans';

export type { TextRewriteConfig };

const MAX_RULES = 256;
const MAX_CHAIN = 4;

type SetTextEvent = { self?: NativeJavaValue; args: NativeJavaValue[] };

function rewrite(
	state: State,
	key: string,
	view: NativeJavaValue,
	text: NativeJavaValue,
): NativeJavaArgument | undefined {
	'worklet';
	const common = shared();
	const incoming = textOf(state.java, text);

	if (incoming === undefined) {
		return undefined;
	}

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
		const next: NativeJavaArgument | null = rule ? applyRule(state, current, rule) : null;

		if (!rule || !next) {
			break;
		}

		current = next;
		currentText = rule.rendered;
		stages.push(currentText);
		chain.push({ rendered: rule.rendered, edits: rule.edits });
	}

	common.chains.set(key, chain);

	const entry = rememberView(state, key, view);

	entry.shown = stages;
	showBeforeNextDraw(state, key);

	if (current === text) {
		return undefined;
	}

	settleLayout(state, key);

	return current;
}

function onPreDraw(stateKey: string): NativeJavaArgument {
	'worklet';
	const state = stateOf(stateKey);

	if (!state) {
		return { type: 'boolean', value: true };
	}

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
		if (!show.includes(key)) {
			guarded(state, 'position text hosts', () => positionAll(state, key));
		}
	}

	return { type: 'boolean', value: true };
}

function onAttachChange(stateKey: string, call: NativeJavaProxyCall) {
	'worklet';
	const state = stateOf(stateKey);
	const key = keyOf(call.args[0]);

	if (!state || !key) return;

	if (call.method === 'onViewAttachedToWindow') {
		if (state.views.get(key)?.shown) {
			showBeforeNextDraw(state, key);
		}

		return;
	}

	for (const group of state.groupsById.values()) {
		if (group.owner === key) {
			release(state, group);
		}
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

	setState(key, state);

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

function unshare(state: State, rendered: string) {
	'worklet';
	const common = shared().rendered;
	const count = (common.get(rendered) ?? 1) - 1;

	state.rendered.delete(rendered);

	if (count > 0) {
		common.set(rendered, count);
	} else {
		common.delete(rendered);
	}
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

	if (previous) {
		unshare(state, previous.rendered);
	}

	state.rules.delete(original);
	state.rules.set(original, {
		rendered,
		edits: edits.map(normalizeEdit).sort((left, right) => right.start - left.start),
	});
	state.rendered.add(rendered);
	shared().rendered.set(rendered, (shared().rendered.get(rendered) ?? 0) + 1);

	if (state.rules.size <= MAX_RULES) return;

	const oldest = state.rules.keys().next().value;

	if (oldest !== undefined) {
		removeRule(stateKey, oldest);
	}
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

		if (!slot) {
			continue;
		}

		slot.anchor = anchor;

		if (group.owner) {
			schedulePosition(state, group.owner);
		}

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

		if (host && parent) {
			state.java.invoke(parent, 'removeView', [host]);
		}
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

	// Copied first: reapplying a text runs the setText hook inline, which moves the view to the end of `views`.
	const entries = [...state.views.values()];

	for (const entry of entries) {
		if (rendered === undefined || entry.shown?.includes(rendered)) {
			reapply(stateKey, entry.view);
		}
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

	for (const rendered of state.rendered) unshare(state, rendered);

	state.rules.clear();
	refresh(stateKey);

	for (const groupId of state.groupsById.keys()) removeGroup(stateKey, groupId);

	for (const reference of state.observers.values()) {
		if (reference && javaFlag(state.java.invoke(reference, 'isAlive', []))) {
			state.java.invoke(reference, 'removeOnPreDrawListener', [state.proxies.preDraw]);
		}
	}

	for (const entry of state.views.values()) {
		const view = javaReference(entry.view);

		if (!view || !entry.listening) {
			continue;
		}

		state.java.invoke(view, 'removeOnAttachStateChangeListener', [state.proxies.attach]);
		state.java.invoke(view, 'removeOnLayoutChangeListener', [state.proxies.layout]);
	}

	setState(stateKey, undefined);
	state.scope.dispose();
}
