import { ownData, ownKeys, propertyChild, type InspectChild } from '~/metro/inspect-value.dev';
import { moduleExports } from '~/metro/module-info.dev';

/** A key that contains the query: the keys from the module's exports down to it, and how to read it. */
export type KeyMatch = {
	/** Property keys or `[[Prototype]]`; empty when the exports themselves match by name. */
	path: string[];
	/** The object that owns the key, which a getter runs against; absent for the exports themselves. */
	owner?: object;
	child: InspectChild;
};

/** The module each export object belongs to: a module's exports, each object they hold and its `prototype`. */
export type ExportOwners = Map<object, number>;

/** Keys of one module's exports read to claim their objects; a huge export claims only its first few. */
const MAX_CLAIMED_KEYS = 200;

/** Levels below a module's exports a search descends; `default › prototype › method` is three. */
const MAX_DEPTH = 4;
/** Keys one module's walk reads, so a module holding huge arrays or a cycle of objects stays cheap. */
const MAX_KEYS = 20_000;

/** One module's walk: what it looks for, where it has been and what it found. */
type Walk = {
	id: number;
	needle: string;
	owners: ExportOwners;
	limit: number;
	seen: WeakSet<object>;
	keys: number;
	matches: KeyMatch[];
};

let intrinsics: WeakSet<object> | undefined;

/**
 * @description Maps each loaded module's exports, the objects they hold and those objects' `prototype`, to the
 * first module exporting them, so `React.Component.prototype` is searched under React alone rather than under
 * every class extending it. Reads data properties only.
 * @param ids The loaded modules' ids.
 * @returns The owner of each export object.
 */
export function exportOwners(ids: readonly number[]): ExportOwners {
	const owners: ExportOwners = new Map();

	// Exports first, so a module's own exports stay its own when another module holds them too.
	for (let i = 0, len = ids.length; i < len; i++) {
		claim(owners, moduleExports(ids[i]), ids[i]);
	}

	for (let i = 0, len = ids.length; i < len; i++) {
		const id = ids[i];
		const exported = moduleExports(id);

		if (!isObjectLike(exported)) {
			continue;
		}

		const keys = ownKeys(exported);

		for (let k = 0, len = Math.min(keys.length, MAX_CLAIMED_KEYS); k < len; k++) {
			const held = ownData(exported, keys[k]);

			if (claim(owners, held, id)) {
				claim(owners, ownData(held, 'prototype'), id);
			}
		}
	}

	return owners;
}

// UNKNOWN: an export can hold any value; only objects and functions are claimed.
function claim(owners: ExportOwners, value: unknown, id: number): value is object {
	if (!isObjectLike(value) || isIntrinsic(value)) {
		return false;
	}

	if (!owners.has(value)) {
		owners.set(value, id);
	}

	return true;
}

/**
 * @description Finds the keys containing `needle` under a module's exports: own properties, prototypes and
 * function names, a few levels deep. Getters never run; a throwing proxy only ends its own branch.
 * @param id The module's id.
 * @param exported The module's exports.
 * @param needle The lower-cased query.
 * @param owners Every loaded module's exports, from {@link exportOwners}.
 * @param limit The most matches to keep.
 * @returns The matches, in walk order.
 */
export function searchKeys(
	id: number,
	exported: MetroExport,
	needle: string,
	owners: ExportOwners,
	limit: number,
): KeyMatch[] {
	const walk: Walk = { id, needle, owners, limit, seen: new WeakSet(), keys: 0, matches: [] };

	if (functionNameMatches(exported, needle)) {
		walk.matches.push({ path: [], child: exportsChild(exported) });
	}

	visit(walk, exported, [], 0);

	return walk.matches;
}

// UNKNOWN: walks whatever a module exports.
function visit(walk: Walk, value: unknown, path: string[], depth: number) {
	if (!isObjectLike(value) || walk.seen.has(value) || isIntrinsic(value)) {
		return;
	}

	const owner = walk.owners.get(value);

	if (owner !== void 0 && owner !== walk.id) {
		return;
	}

	walk.seen.add(value);

	const keys = ownKeys(value);

	for (let i = 0, len = keys.length; i < len; i++) {
		if (walk.matches.length >= walk.limit || ++walk.keys > MAX_KEYS) {
			return;
		}

		const child = propertyChild(value, keys[i]);
		const childPath = [...path, child.key];
		// A getter is matched by its key alone; its value is only read when the user runs it.
		const current = child.getter ? void 0 : readSafely(child);

		if (
			child.key.toLowerCase().includes(walk.needle) ||
			functionNameMatches(current, walk.needle)
		) {
			walk.matches.push({ path: childPath, owner: value, child });
		}

		if (depth + 1 < MAX_DEPTH) {
			visit(walk, current, childPath, depth + 1);
		}
	}

	if (depth + 1 < MAX_DEPTH) {
		visit(walk, prototypeOf(value), [...path, '[[Prototype]]'], depth + 1);
	}
}

// UNKNOWN: a function's `name` is matched only when the value is a function.
function functionNameMatches(value: unknown, needle: string): boolean {
	if (typeof value !== 'function') {
		return false;
	}

	const name = ownData(value, 'name');

	return typeof name === 'string' && name.toLowerCase().includes(needle);
}

function exportsChild(exported: MetroExport): InspectChild {
	return { key: 'module.exports', read: () => exported, getter: false, internal: false };
}

// UNKNOWN: a property can hold any value; a non-getter child reads a value already taken from its descriptor.
function readSafely(child: InspectChild): unknown {
	try {
		return child.read();
	} catch {
		// A descriptor trap threw; the branch has nothing to walk.
		return void 0;
	}
}

function prototypeOf<T extends object>(value: T): object | null {
	try {
		return Object.getPrototypeOf(value);
	} catch {
		// A proxy's `getPrototypeOf` trap may throw; the walk skips the chain.
		return null;
	}
}

// UNKNOWN: narrows any value to one with keys to walk.
function isObjectLike(value: unknown): value is object {
	return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/** The engine's own prototypes and the global object: every value reaches them, and none holds Discord's code. */
function isIntrinsic<T extends object>(value: T): boolean {
	intrinsics ??= new WeakSet<object>(
		[
			globalThis,
			Object.prototype,
			Function.prototype,
			Array.prototype,
			String.prototype,
			Number.prototype,
			Boolean.prototype,
			Symbol.prototype,
			Map.prototype,
			Set.prototype,
			WeakMap.prototype,
			WeakSet.prototype,
			Promise.prototype,
			Error.prototype,
			RegExp.prototype,
			Date.prototype,
			ArrayBuffer.prototype,
			Object.getPrototypeOf(Uint8Array.prototype),
		].filter(isObjectLike),
	);

	return intrinsics.has(value);
}
