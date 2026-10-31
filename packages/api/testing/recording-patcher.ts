import type { PatchOptions, PatchParent, PatcherInstance } from '../src/patcher';

type PatchKind = 'before' | 'instead' | 'after';

/** One patch a recording patcher applied, kept until it is removed. */
export type PatchRecord = {
	kind: PatchKind;
	target: PatchParent;
	method: string;
	caller: string | undefined;
};

/** A patcher that really patches, and records each patch it holds in `patches`. */
export type RecordingPatcher = PatcherInstance & {
	patches: PatchRecord[];
	createPatcher: (defaultOptions: string | PatchOptions) => PatcherInstance;
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
 * @returns The patcher, with `createPatcher` for tagged patchers that share its record.
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

	function patch(kind: PatchKind, caller: string | undefined) {
		return (target: PatchParent, method: string, callback: Callback) => {
			const record: PatchRecord = { kind, target, method, caller };
			const methods = hooks.get(target) ?? new Map<string, Hook>();
			const hooked = methods.get(method) ?? hook(target, method);

			hooks.set(target, methods);
			methods.set(method, hooked);
			hooked.callbacks.set(record, callback);
			patches.push(record);

			return () => unpatch(record);
		};
	}

	function unpatchAllBy(caller: string | undefined) {
		const removed = patches.filter(
			(record) => caller === undefined || record.caller === caller,
		);

		for (const record of removed) unpatch(record);
	}

	function createPatcher(defaultOptions: string | PatchOptions): PatcherInstance {
		const caller =
			typeof defaultOptions === 'string' ? defaultOptions : (defaultOptions.caller ?? 'test');

		return {
			before: patch('before', caller) as PatcherInstance['before'],
			instead: patch('instead', caller) as PatcherInstance['instead'],
			after: patch('after', caller) as PatcherInstance['after'],
			unpatchAll: () => unpatchAllBy(caller),
		};
	}

	return {
		patches,
		createPatcher,
		before: patch('before', undefined) as PatcherInstance['before'],
		instead: patch('instead', undefined) as PatcherInstance['instead'],
		after: patch('after', undefined) as PatcherInstance['after'],
		unpatchAll: () => unpatchAllBy(undefined),
	};
}
