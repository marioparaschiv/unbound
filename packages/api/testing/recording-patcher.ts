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
	result?: unknown;
};

// UNKNOWN: a patch callback returns whatever the test's patch returns.
type Callback = (context: Context) => unknown;

/**
 * @description Creates a patcher whose patches wrap the method for real and are listed in `patches` until removed.
 * @returns The patcher, with `createPatcher` for tagged patchers that share its record.
 */
export function createRecordingPatcher(): RecordingPatcher {
	const patches: PatchRecord[] = [];
	const unpatches = new Map<PatchRecord, () => void>();

	function patch(kind: PatchKind, caller: string | undefined) {
		return (target: PatchParent, method: string, callback: Callback) => {
			const original: Method = Reflect.get(target, method);
			const record: PatchRecord = { kind, target, method, caller };

			function patched(this: PatchParent, ...args: never[]) {
				const context: Context = { args, this: this, original };

				if (kind === 'before') {
					const replaced = callback(context);

					return original.apply(
						this,
						Array.isArray(replaced) ? (replaced as never[]) : args,
					);
				}

				if (kind === 'instead') {
					return callback(context);
				}

				context.result = original.apply(this, args);

				const result = callback(context);

				return result === undefined ? context.result : result;
			}

			Reflect.set(target, method, patched);
			patches.push(record);

			function unpatch() {
				if (!unpatches.delete(record)) return;

				Reflect.set(target, method, original);
				patches.splice(patches.indexOf(record), 1);
			}

			unpatches.set(record, unpatch);

			return unpatch;
		};
	}

	function unpatchAllBy(caller: string | undefined) {
		for (const record of [...patches].reverse()) {
			if (caller === undefined || record.caller === caller) {
				unpatches.get(record)?.();
			}
		}
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
