import type { PatchParent, ReactPatcher, after, before, instead } from '../src/patcher';

import { createReactPatcher, type Install, type MethodContext } from './react-patcher';

type PatchKind = 'before' | 'instead' | 'after';

/** One patch a recording patcher applied, kept until it is removed. */
export type PatchRecord = {
	kind: PatchKind;
	/** The object holding the method; the lazy handle while the patch is pending. */
	target: PatchParent;
	/** The patched method; empty while a React patch waits, which finds the render only once its module registers. */
	method: string;
	/** True while the patch waits for its lazy handle's module to register. */
	pending: boolean;
};

/** A patcher that really patches, and records each patch it holds in `patches`. */
export type RecordingPatcher = {
	before: typeof before;
	instead: typeof instead;
	after: typeof after;
	/** React patches, which record the render they wrap: a `memo`'s `type`, a `forwardRef`'s or class's `render`. */
	react: ReactPatcher;
	/** Removes every patch this patcher holds. */
	unpatchAll: () => void;
	patches: PatchRecord[];
};

// UNKNOWN: a patched method returns whatever the code under test returns.
type Method = (...args: never[]) => unknown;

type Context = MethodContext;

// UNKNOWN: a patch callback returns whatever the test's patch returns.
type Callback = (context: Context) => unknown;

type Hook = {
	original: Method;
	callbacks: Map<PatchRecord, Callback>;
};

function run(hook: Hook, kind: PatchKind, context: Context) {
	for (const [record, callback] of hook.callbacks) {
		if (record.kind !== kind) {
			continue;
		}

		const returned = callback.call(context.this, context);

		if (kind === 'before') {
			if (Array.isArray(returned)) {
				context.args = returned as never[];
			}
		} else if (returned !== undefined) {
			context.result = returned;
		}
	}
}

function hook(target: PatchParent, method: string): Hook {
	const created: Hook = { original: Reflect.get(target, method), callbacks: new Map() };

	function patched(this: PatchParent, ...args: never[]) {
		const context: Context = {
			args,
			this: this,
			original: (...next: never[]) => created.original.apply(this, next),
			result: null,
		};

		run(created, 'before', context);

		if ([...created.callbacks.keys()].some((record) => record.kind === 'instead')) {
			run(created, 'instead', context);
		} else {
			context.result = context.original(...context.args);
		}

		run(created, 'after', context);

		return context.result;
	}

	Reflect.set(target, method, patched);

	return created;
}

/** Calls `onLoad` with the module a lazy handle resolves to once one is registered, at once for a plain object; returns what stops waiting. */
export type WhenLoaded = (target: PatchParent, onLoad: (module: PatchParent) => void) => () => void;

// A plain object is the target already, so nothing waits.
function patchNow(target: PatchParent, onLoad: (module: PatchParent) => void): () => void {
	onLoad(target);

	return () => {};
}

/**
 * @description Creates a patcher whose patches wrap the method for real and are listed in `patches` until removed.
 * A patch on a lazy handle whose module is not registered yet is listed as pending and applies when it registers.
 * @param whenLoaded Resolves a lazy handle to its module, as the fake metro does; omitted, every target is taken as it is.
 * @returns The patcher.
 */
export function createRecordingPatcher(whenLoaded: WhenLoaded = patchNow): RecordingPatcher {
	const patches: PatchRecord[] = [];
	// Keyed by the resolved module, so a handle patches whichever module is registered for it in this session.
	const hooks = new Map<PatchParent, Map<string, Hook>>();
	const waiting = new Map<PatchRecord, () => void>();

	function unpatch(record: PatchRecord) {
		const index = patches.indexOf(record);

		if (index === -1) return;

		patches.splice(index, 1);
		waiting.get(record)?.();
		waiting.delete(record);

		const methods = hooks.get(record.target);
		const hooked = methods?.get(record.method);

		if (!methods || !hooked) return;

		hooked.callbacks.delete(record);

		if (hooked.callbacks.size > 0) return;

		Reflect.set(record.target, record.method, hooked.original);
		methods.delete(record.method);
	}

	const install: Install = (kind, target, place, method = '') => {
		const record: PatchRecord = { kind, target, method, pending: true };

		patches.push(record);
		waiting.set(
			record,
			whenLoaded(target, (module) => {
				const placed = place(module);
				const { parent, callback } = placed;
				const methods = hooks.get(parent) ?? new Map<string, Hook>();
				const hooked = methods.get(placed.method) ?? hook(parent, placed.method);

				waiting.delete(record);
				hooks.set(parent, methods);
				methods.set(placed.method, hooked);
				hooked.callbacks.set(record, callback);
				Object.assign(record, { target: parent, method: placed.method, pending: false });
			}),
		);

		return () => unpatch(record);
	};

	function patch(kind: PatchKind) {
		return (target: PatchParent, method: string, callback: Callback) =>
			install(kind, target, (module) => ({ parent: module, method, callback }), method);
	}

	return {
		patches,
		before: patch('before') as RecordingPatcher['before'],
		instead: patch('instead') as RecordingPatcher['instead'],
		after: patch('after') as RecordingPatcher['after'],
		react: createReactPatcher(install),
		unpatchAll: () => {
			// `unpatch` splices `patches`, so walk a copy.
			for (const record of patches.slice()) unpatch(record);
		},
	};
}
