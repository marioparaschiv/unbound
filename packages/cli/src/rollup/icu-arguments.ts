import { parseIcu, type IcuArgumentNode, type IcuNode } from '@unbound-app/contracts/icu-parse';

/** What one ICU argument accepts, as `format`'s typings spell it. */
export type IcuArgument =
	| { kind: 'any' }
	| { kind: 'number' }
	| { kind: 'date' }
	| { kind: 'select'; options: string[]; other: boolean };

/** Every argument one message reads, by name. */
export type IcuArguments = Map<string, IcuArgument>;

/** A message's arguments, and the names of its plural, selectordinal and select arguments without `other`. */
export type IcuMessage = { arguments: IcuArguments; withoutOther: string[] };

const NUMERIC_TYPES = new Set(['number', 'spellout', 'ordinal', 'duration']);
const DATE_TYPES = new Set(['date', 'time']);

function merge(left: IcuArgument | undefined, right: IcuArgument): IcuArgument {
	if (!left || left.kind === 'any') {
		return right;
	}

	if (right.kind === 'any') {
		return left;
	}

	if (left.kind === 'select' && right.kind === 'select') {
		return {
			kind: 'select',
			options: [...new Set([...left.options, ...right.options])],
			other: left.other || right.other,
		};
	}

	return left.kind === right.kind ? left : { kind: 'any' };
}

function record(found: IcuArguments, name: string, argument: IcuArgument): void {
	found.set(name, merge(found.get(name), argument));
}

function argumentOf(node: IcuArgumentNode): IcuArgument {
	if (NUMERIC_TYPES.has(node.type)) {
		return { kind: 'number' };
	}

	return DATE_TYPES.has(node.type) ? { kind: 'date' } : { kind: 'any' };
}

// Records every argument in `nodes`, nested branches included; `withoutOther` collects each branching one lacking `other`.
function collect(nodes: IcuNode[], found: IcuArguments, withoutOther: string[]): void {
	for (const node of nodes) {
		if (node.kind === 'text' || node.kind === 'pound') {
			continue;
		}

		if (node.kind === 'argument') {
			record(found, node.name, argumentOf(node));
			continue;
		}

		const selectors = [...node.branches.keys()];

		// Nested arguments first, matching the order the message reads them in.
		for (const branch of node.branches.values()) collect(branch, found, withoutOther);

		if (!node.branches.has('other')) {
			withoutOther.push(node.name);
		}

		record(
			found,
			node.name,
			node.kind === 'select'
				? {
						kind: 'select',
						options: selectors.filter((selector) => selector !== 'other'),
						other: node.branches.has('other'),
					}
				: { kind: 'number' },
		);
	}
}

/**
 * @description Lists the arguments an ICU MessageFormat string reads, nested branches included.
 * @param message The message, such as `{count, plural, one {# file} other {# files}}`.
 * @returns Each argument by name; throws naming the position of a syntax error.
 */
export function readIcuArguments(message: string): IcuArguments {
	return readIcuMessage(message).arguments;
}

/**
 * @description Reads an ICU MessageFormat string: the arguments it reads, and the branching ones that lack `other`.
 * @param message The message, such as `{count, plural, one {# file} other {# files}}`.
 * @returns Each argument by name, and the names of plural, selectordinal and select arguments without `other`.
 */
export function readIcuMessage(message: string): IcuMessage {
	const found: IcuArguments = new Map();
	const withoutOther: string[] = [];

	collect(parseIcu(message), found, withoutOther);

	return { arguments: found, withoutOther };
}

/**
 * @description Spells a string as a single-quoted TypeScript literal, as the repo's formatter writes it.
 * @param value The string.
 * @returns The literal, such as `'male'`.
 */
export function typeLiteral(value: string): string {
	return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/**
 * @description Spells a property key the way the formatter leaves it: bare when it is an identifier, quoted otherwise.
 * @param key The key.
 * @returns The key as written in a type literal.
 */
export function typeKey(key: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(key) ? key : typeLiteral(key);
}

/**
 * @description Spells the TypeScript type `format` accepts for one argument.
 * @param argument The argument.
 * @returns The type, such as `number` or `'male' | 'female'`.
 */
export function icuArgumentType(argument: IcuArgument): string {
	if (argument.kind === 'number') {
		return 'number';
	}

	if (argument.kind === 'date') {
		return 'Date | number';
	}

	if (argument.kind === 'any' || argument.options.length === 0) {
		return 'string | number';
	}

	const literals = argument.options.map((option) => typeLiteral(option));

	return [...literals, ...(argument.other ? ['(string & {})'] : [])].join(' | ');
}

export default { readIcuArguments, readIcuMessage, typeLiteral, typeKey, icuArgumentType };
