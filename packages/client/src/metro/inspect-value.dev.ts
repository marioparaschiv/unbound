/** What an inspected value is, which picks its colour and whether it opens. */
export type ValueKind =
	| 'string'
	| 'number'
	| 'boolean'
	| 'nullish'
	| 'symbol'
	| 'function'
	| 'class'
	| 'array'
	| 'object'
	| 'error';

/** A one-line summary of a value, read without running any of its getters. */
export type ValuePreview = {
	kind: ValueKind;
	text: string;
	/** Whether the value has children to list: objects and functions do. */
	expandable: boolean;
};

/** A property or internal slot of an inspected object. */
export type InspectChild = {
	key: string;
	/** Reads the child's value; for a getter this runs it. */
	// UNKNOWN: a property or slot can hold any value.
	read: () => unknown;
	/** An accessor, run only when asked: a getter can be slow, throw, or load modules. */
	getter: boolean;
	/** An engine slot such as `[[Prototype]]` rather than a property. */
	internal: boolean;
};

/** One page of an object's properties, and the slots listed after them. */
export type InspectChildren = {
	properties: InspectChild[];
	/** How many properties the object owns, listed or not. */
	total: number;
	internal: InspectChild[];
};

const MAX_STRING = 120;

/**
 * @description Summarises a value in one line. It reads only own data properties, so a getter never runs.
 * @param value Any value, including a proxy that throws on access.
 * @returns The value's kind, text and whether it opens.
 */
// UNKNOWN: inspects whatever a module exports, proxies included.
export function previewValue(value: unknown): ValuePreview {
	try {
		return preview(value);
	} catch (error) {
		return errorPreview(error);
	}
}

/**
 * @description Summarises a thrown error, never throwing itself.
 * @param error What was thrown.
 * @returns The error's preview.
 */
// UNKNOWN: JavaScript can throw any value.
export function errorPreview(error: unknown): ValuePreview {
	let text: string;

	try {
		text = String(error);
	} catch {
		text = 'Error';
	}

	return { kind: 'error', text: truncate(text), expandable: false };
}

/**
 * @description Lists one page of an object's own properties, then its `[[Entries]]` and `[[Prototype]]` slots.
 * Only the listed keys' descriptors are read, so a huge array costs one key list.
 * @template T The object or function's type; any non-primitive lists.
 * @param value The object or function to list.
 * @param offset The first property to list.
 * @param limit The most properties to list.
 * @returns The listed properties, their total and the slots.
 */
export function listChildren<T extends object>(
	value: T,
	offset: number,
	limit: number,
): InspectChildren {
	const keys = ownKeys(value);
	const properties: InspectChild[] = [];

	for (let i = offset, len = Math.min(keys.length, offset + limit); i < len; i++) {
		properties.push(propertyChild(value, keys[i]));
	}

	return { properties, total: keys.length, internal: slots(value) };
}

// UNKNOWN: inspects whatever a module exports.
function preview(value: unknown): ValuePreview {
	switch (typeof value) {
		case 'string':
			return leaf('string', JSON.stringify(truncate(value)));
		case 'number':
		case 'boolean':
			return leaf(typeof value as ValueKind, String(value));
		case 'bigint':
			return leaf('number', `${value}n`);
		case 'symbol':
			return leaf('symbol', symbolLabel(value));
		case 'undefined':
			return leaf('nullish', 'undefined');
		case 'function':
			return functionPreview(value);
		case 'object':
			return value === null ? leaf('nullish', 'null') : objectPreview(value);
	}
}

function functionPreview(fn: Function): ValuePreview {
	const name = ownData(fn, 'name');
	const label = typeof name === 'string' && name ? name : '(anonymous)';

	return isClass(fn)
		? { kind: 'class', text: `class ${label}`, expandable: true }
		: { kind: 'function', text: `ƒ ${label}()`, expandable: true };
}

function objectPreview<T extends object>(value: T): ValuePreview {
	if (Array.isArray(value)) {
		return { kind: 'array', text: `Array(${value.length})`, expandable: true };
	}

	if (value instanceof Map || value instanceof Set) {
		return {
			kind: 'object',
			text: `${value.constructor.name}(${value.size})`,
			expandable: true,
		};
	}

	if (value instanceof Error) {
		return {
			kind: 'error',
			text: truncate(`${value.name}: ${value.message}`),
			expandable: true,
		};
	}

	return { kind: 'object', text: `${constructorName(value)} {…}`, expandable: true };
}

/**
 * A class component inherits `isReactComponent`, and a Babel-transpiled class owns prototype methods besides
 * `constructor`; Hermes prints bytecode functions as `[bytecode]`, so only native class source says `class`.
 */
function isClass(fn: Function): boolean {
	const prototype = ownData(fn, 'prototype');

	if (prototype && typeof prototype === 'object') {
		if ('isReactComponent' in prototype || ownKeys(prototype).length > 1) {
			return true;
		}
	}

	try {
		return Function.prototype.toString.call(fn).startsWith('class');
	} catch {
		// A native or proxied function may refuse to print; it is not a class we can tell.
		return false;
	}
}

function constructorName<T extends object>(value: T): string {
	// A prototype owns the constructor that points back at it: `Object.prototype`, a class's `prototype`.
	const own = ownData(value, 'constructor');

	if (typeof own === 'function' && ownData(own, 'prototype') === value) {
		const name = ownData(own, 'name');

		return `${typeof name === 'string' && name ? name : '(anonymous)'}.prototype`;
	}

	const prototype = Object.getPrototypeOf(value);

	if (prototype === null) {
		return '[Object: null prototype]';
	}

	const constructor = ownData(prototype, 'constructor');
	const name = typeof constructor === 'function' ? ownData(constructor, 'name') : void 0;

	return typeof name === 'string' && name ? name : 'Object';
}

/**
 * @description Describes one own property from its descriptor, so a getter is wrapped rather than run.
 * @template T The owning object or function's type.
 * @param value The owner.
 * @param key The property's key.
 * @returns The child; one whose descriptor trap threw reads as that error.
 */
export function propertyChild<T extends object>(value: T, key: PropertyKey): InspectChild {
	const label = typeof key === 'symbol' ? symbolLabel(key) : String(key);

	let descriptor: PropertyDescriptor | undefined;

	try {
		descriptor = Object.getOwnPropertyDescriptor(value, key);
	} catch (error) {
		return slot(label, () => {
			throw error;
		});
	}

	if (descriptor && !('value' in descriptor) && descriptor.get) {
		// Reads through the owner, which runs the same getter with the owner as `this`.
		return { key: label, read: () => Reflect.get(value, key), getter: true, internal: false };
	}

	const current = descriptor?.value;

	return { key: label, read: () => current, getter: false, internal: false };
}

function slots<T extends object>(value: T): InspectChild[] {
	const internal: InspectChild[] = [];

	if (value instanceof Map || value instanceof Set) {
		internal.push(slot('[[Entries]]', () => Array.from(value)));
	}

	let prototype: object | null = null;

	try {
		prototype = Object.getPrototypeOf(value);
	} catch (error) {
		internal.push(
			slot('[[Prototype]]', () => {
				throw error;
			}),
		);
	}

	if (prototype !== null) {
		internal.push(slot('[[Prototype]]', () => prototype));
	}

	return internal;
}

function slot(key: string, read: InspectChild['read']): InspectChild {
	return { key, read, getter: false, internal: true };
}

/**
 * @description Lists an object's own keys, symbols included.
 * @template T The object or function's type.
 * @param value The object.
 * @returns Its keys, or none when a proxy's trap throws.
 */
export function ownKeys<T extends object>(value: T): PropertyKey[] {
	try {
		return Reflect.ownKeys(value);
	} catch {
		// A proxy's `ownKeys` trap may throw; it still shows its prototype.
		return [];
	}
}

/**
 * @description Reads an own data property without running a getter or throwing.
 * @template T The object or function's type.
 * @param value The owner.
 * @param key The property's key.
 * @returns Its value, or `undefined` for an accessor, a missing key or a trap that threw.
 */
// UNKNOWN: a data property can hold any value.
export function ownData<T extends object>(value: T, key: PropertyKey): unknown {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);

		return descriptor && 'value' in descriptor ? descriptor.value : void 0;
	} catch {
		// A proxy's descriptor trap may throw; the caller falls back to a generic label.
		return void 0;
	}
}

function symbolLabel(symbol: symbol): string {
	return `Symbol(${symbol.description ?? ''})`;
}

function leaf(kind: ValueKind, text: string): ValuePreview {
	return { kind, text, expandable: false };
}

function truncate(text: string): string {
	return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…` : text;
}
