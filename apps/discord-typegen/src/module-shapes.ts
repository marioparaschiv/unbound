import type { ModuleRecord } from './types';

import { EXPORTS, paramName } from './metro-params';
import intern from './intern';

const ASSIGN = /^\s+(r\d+) = (.*);$/;
const KEY_WRITE = /^\s+(r\d+)\['((?:[^'\\]|\\.)*)'\] = (.*);$/;
// hermes-dec prints every closure as `rN = function(...) {`, closed by `};` at the same indent.
const NESTED_FUNCTION = /^(\s+)r\d+ = function\*? ?\(/;
const GETTER = /Original name: get ([\w$]+),/;
const EXPORTS_PARAM = paramName(EXPORTS);

/** What a Metro lookup can match on one module: its export names and the keys of an object default export. */
export type ModuleShape = {
	id: number;
	path: string | undefined;
	/** Names the factory assigns onto its exports object, or defines export getters for; sorted. */
	exportNames: string[];
	/** Keys of the object the module exports as `default`; empty when the default is anything else. */
	defaultKeys: string[];
};

/**
 * @description Reads the top-level keys of an object literal as hermes-dec prints it: `{'a': null, 'b': {'c': 1}}`.
 * @returns The keys at depth one, in source order.
 */
export function objectKeys(literal: string): string[] {
	const keys: string[] = [];
	let depth = 0;

	for (let i = 0, len = literal.length; i < len; i++) {
		const char = literal[i];

		if (char === '{' || char === '[') {
			depth++;
		} else if (char === '}' || char === ']') {
			depth--;
		} else if (char === "'") {
			let end = i + 1;

			while (end < len && literal[end] !== "'") end += literal[end] === '\\' ? 2 : 1;

			if (depth === 1 && literal.startsWith(': ', end + 1)) {
				keys.push(literal.slice(i + 1, end).replace(/\\(.)/g, '$1'));
			}

			i = end;
		}
	}

	return keys;
}

/**
 * @description Records what a lookup can match on a module, before its source is dropped. It follows the
 * factory's own registers in order, skipping nested functions, so a register reused after holding the exports
 * object stops counting.
 * The default export's keys are read only from an object literal the factory builds at its top level, the shape
 * Discord's action-creator modules use: `r2 = {'sendMessage': null, ...}; r3['default'] = r2;`.
 * @returns The module's shape.
 */
export function shapeOf(module: ModuleRecord): ModuleShape {
	const exportRegisters = new Set<string>();
	// The keys of the object literal each register holds, shared with the default export once assigned to it.
	const objects = new Map<string, Set<string>>();
	const names = new Set<string>();
	let defaultKeys = new Set<string>();

	const lines = module.source.split('\n');
	let nestedEnd: string | undefined;

	// The first and last lines open and close the factory itself.
	for (let i = 1, len = lines.length - 1; i < len; i++) {
		const line = lines[i]!;

		// A nested function's `a5` is its own parameter, so only the factory's own statements count.
		if (nestedEnd !== undefined) {
			nestedEnd = line === nestedEnd ? undefined : nestedEnd;

			continue;
		}

		const nested = NESTED_FUNCTION.exec(line);

		if (nested) {
			const getter = GETTER.exec(line);

			if (getter) {
				names.add(intern(getter[1]!));
			}

			nestedEnd = `${nested[1]}};`;

			continue;
		}

		const write = KEY_WRITE.exec(line);

		if (write) {
			const [, register, key, value] = write;

			if (exportRegisters.has(register!)) {
				names.add(intern(key!));
				defaultKeys = key === 'default' ? (objects.get(value!) ?? new Set()) : defaultKeys;
			}

			objects.get(register!)?.add(intern(key!));

			continue;
		}

		const assign = ASSIGN.exec(line);

		if (assign) {
			const [, register, value] = assign;

			exportRegisters[value === EXPORTS_PARAM ? 'add' : 'delete'](register!);

			if (value!.startsWith('{')) {
				objects.set(register!, new Set(objectKeys(value!).map(intern)));
			} else {
				objects.delete(register!);
			}
		}
	}

	return {
		id: module.id,
		path: module.path,
		exportNames: [...names].sort(),
		defaultKeys: [...defaultKeys],
	};
}

export default { objectKeys, shapeOf };
