const MAX_DEPTH = 5;
const COLOR_KEY = /colou?r$/i;
const COLOR_STRING =
	/^(#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|(?:rgba?|hsla?)\([\d\s.,%/+-]+\)|[a-z]+)$/i;
const ARGB_MIN = -0x80000000;
const ARGB_MAX = 0xffffffff;

/** A value a chat row can hold. */
export type RowValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| RowValue[]
	| { [key: string]: RowValue };

/** A value in a chat row that Discord's native code cannot draw, by its path in the row. */
export type InvalidRowValue = { path: string; reason: string };

type Container = RowValue[] | { [key: string]: RowValue };

type Found = (parent: Container, key: string, problem: InvalidRowValue) => void;

function isContainer(value: RowValue): value is Container {
	if (Array.isArray(value)) {
		return true;
	}

	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const prototype: object | null = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}

function isValidColor(value: RowValue): boolean {
	if (value === null || value === undefined) {
		return true;
	}

	if (typeof value === 'number') {
		return Number.isInteger(value) && value >= ARGB_MIN && value <= ARGB_MAX;
	}

	return typeof value === 'string' && COLOR_STRING.test(value.trim());
}

function invalidReason(key: string, value: RowValue): string | undefined {
	if (typeof value === 'number' && !Number.isFinite(value)) {
		return `is ${value}`;
	}

	if (COLOR_KEY.test(key) && !isValidColor(value)) {
		return `is not a colour (${JSON.stringify(value) ?? typeof value})`;
	}

	return undefined;
}

function visit(
	container: Container,
	path: string,
	depth: number,
	seen: WeakSet<object>,
	found: Found,
) {
	if (depth > MAX_DEPTH || seen.has(container)) {
		return;
	}

	seen.add(container);

	for (const [key, value] of Object.entries(container)) {
		const at = path ? `${path}.${key}` : key;
		const reason = invalidReason(key, value);

		if (reason) {
			found(container, key, { path: at, reason });
		} else if (isContainer(value)) {
			visit(value, at, depth + 1, seen, found);
		}
	}
}

/**
 * @description Lists the values in a chat row that Discord's native code cannot draw: numbers that are NaN or
 * infinite, and colours that are neither an ARGB integer nor a CSS colour string.
 * @param row The row.
 * @returns Each invalid value's path and why it is invalid.
 */
export function findInvalidRowValues(row: RowValue): InvalidRowValue[] {
	const problems: InvalidRowValue[] = [];

	if (isContainer(row)) {
		visit(row, '', 0, new WeakSet(), (_, __, problem) => problems.push(problem));
	}

	return problems;
}

/**
 * @description Removes the values in a chat row that Discord's native code cannot draw, so it falls back to its
 * defaults for them instead of crashing or drawing garbage.
 * @param row The row, changed in place.
 * @returns The removed values.
 */
export function dropInvalidRowValues(row: RowValue): InvalidRowValue[] {
	const removed: InvalidRowValue[] = [];

	if (isContainer(row)) {
		visit(row, '', 0, new WeakSet(), (parent, key, problem) => {
			if (Array.isArray(parent)) {
				parent[Number(key)] = null;
			} else {
				delete parent[key];
			}

			removed.push(problem);
		});
	}

	return removed;
}
