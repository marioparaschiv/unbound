import type { PatchParent, after, before, instead } from '../src/patcher';

type PatchKind = 'before' | 'instead' | 'after';

/** One patch a recording patcher applied, kept until it is removed. */
export type PatchRecord = {
	kind: PatchKind;
	target: PatchParent;
	method: string;
};

/** A patcher that really patches, and records each patch it holds in `patches`. */
export type RecordingPatcher = {
	before: typeof before;
	instead: typeof instead;
	after: typeof after;
	/** Removes every patch this patcher holds. */
	unpatchAll: () => void;
	patches: PatchRecord[];
};

// UNKNOWN: a patched method returns whatever the code under test returns.
type Method = (...args: never[]) => unknown;

type Context = {
	args: never[];
	this: PatchParent;
	original: Method;
	result: unknown;
};

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

/**
 * @description Creates a patcher whose patches wrap the method for real and are listed in `patches` until removed.
 * @returns The patcher.
 */
export function createRecordingPatcher(): RecordingPatcher {
	const patches: PatchRecord[] = [];
	const hooks = new Map<PatchParent, Map<string, Hook>>();

	function unpatch(record: PatchRecord) {
		const methods = hooks.get(record.target);
		const hooked = methods?.get(record.method);

		if (!methods || !hooked?.callbacks.delete(record)) return;

		patches.splice(patches.indexOf(record), 1);

		if (hooked.callbacks.size > 0) return;

		Reflect.set(record.target, record.method, hooked.original);
		methods.delete(record.method);
	}

	function patch(kind: PatchKind) {
		return (target: PatchParent, method: string, callback: Callback) => {
			const record: PatchRecord = { kind, target, method };
			const methods = hooks.get(target) ?? new Map<string, Hook>();
			const hooked = methods.get(method) ?? hook(target, method);

			hooks.set(target, methods);
			methods.set(method, hooked);
			hooked.callbacks.set(record, callback);
			patches.push(record);

			return () => unpatch(record);
		};
	}

	return {
		patches,
		before: patch('before') as RecordingPatcher['before'],
		instead: patch('instead') as RecordingPatcher['instead'],
		after: patch('after') as RecordingPatcher['after'],
		unpatchAll: () => {
			// `unpatch` splices `patches`, so walk a copy.
			for (const record of patches.slice()) unpatch(record);
		},
	};
}
