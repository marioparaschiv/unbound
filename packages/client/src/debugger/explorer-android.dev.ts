import type {
	ExplorerClass,
	ExplorerMember,
	ExplorerMemberKind,
	ExplorerObject,
	ExplorerTarget,
	ExplorerValue,
	ExplorerValuesRequest,
} from '@unbound-app/debugger-protocol';
import type {
	NativeJavaBridge,
	NativeJavaClassDescription,
	NativeJavaHandleValue,
	NativeJavaValue,
} from '@unbound-app/types';

import type {
	ExplorerContext,
	ExplorerPage,
	ExplorerSource,
	MemberPage,
} from '~/debugger/explorer.dev';
import { isJavaHandle, type ExplorerHandle } from '~/debugger/explorer-objects.dev';
import { explorerError } from '~/debugger/explorer-errors.dev';
import { onMain, string } from '~/debugger/java-values.dev';

type AndroidKind = 'fields' | 'methods' | 'constructors' | 'interfaces';

/** The Java bridge methods the explorer reads with. */
type ReflectionBridge = Pick<NativeJavaBridge, 'describe' | 'className' | 'batchAsync'>;

/** A class's description, and its members by kind, sorted, built on first use. */
type Described = {
	description: NativeJavaClassDescription;
	members: Partial<Record<AndroidKind, ExplorerMember[]>>;
};

const ANDROID_KINDS: ReadonlySet<ExplorerMemberKind> = new Set<AndroidKind>([
	'fields',
	'methods',
	'constructors',
	'interfaces',
]);
/** How many class descriptions stay cached. */
const DESCRIBED_CAPACITY = 32;
const MAX_CHAIN = 64;
const MAX_TEXT_LENGTH = 500;
const PRIMITIVE_CODES: Record<string, string> = {
	Z: 'boolean',
	B: 'byte',
	C: 'char',
	S: 'short',
	I: 'int',
	J: 'long',
	F: 'float',
	D: 'double',
};

function isAndroidKind(kind: ExplorerMemberKind): kind is AndroidKind {
	return ANDROID_KINDS.has(kind);
}

function clip(text: string): string {
	return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;
}

// UNKNOWN: the Java bridge throws whatever the loader raises.
function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * @description Names a Java class for a declaration: its simple name, with `[]` for each array level.
 * @param name A `Class.getName()`, such as `java.lang.String` or `[I`.
 * @returns The short name, such as `String` or `int[]`.
 */
export function displayType(name: string): string {
	const depth = /^\[*/.exec(name)?.[0].length ?? 0;
	const element = name.slice(depth);
	const base =
		depth === 0
			? element
			: (PRIMITIVE_CODES[element] ?? element.replace(/^L/, '').replace(/;$/, ''));

	return `${base.slice(base.lastIndexOf('.') + 1)}${'[]'.repeat(depth)}`;
}

const byName = (a: ExplorerMember, b: ExplorerMember) =>
	a.name.localeCompare(b.name) || (a.signature ?? '').localeCompare(b.signature ?? '');

/**
 * @description Lists one kind of the members a Java class declares, sorted by name.
 * @param description The class, from `java.describe`.
 * @param kind Which members.
 * @returns The members.
 */
export function describeMembers(
	description: NativeJavaClassDescription,
	kind: AndroidKind,
): ExplorerMember[] {
	const prefix = (isStatic: boolean) => (isStatic ? 'static ' : '');
	const parameterList = (parameters: string[]) => parameters.map(displayType).join(', ');

	switch (kind) {
		case 'fields':
			return description.fields
				.map((field): ExplorerMember => ({
					name: field.name,
					kind,
					type: field.type,
					signature: `${prefix(field.static)}${displayType(field.type)} ${field.name}`,
					static: field.static,
					read: 'auto',
				}))
				.sort(byName);
		case 'methods':
			return description.methods
				.map((method): ExplorerMember => ({
					name: method.name,
					kind,
					type: method.returnType,
					signature: `${prefix(method.static)}${displayType(method.returnType)} ${method.name}(${parameterList(method.parameters)})`,
					returnType: method.returnType,
					parameters: method.parameters,
					static: method.static,
					read: 'never',
				}))
				.sort(byName);
		case 'constructors': {
			const name = displayType(description.name);

			return description.constructors
				.map((parameters): ExplorerMember => ({
					name,
					kind,
					type: null,
					signature: `${name}(${parameterList(parameters)})`,
					parameters,
					read: 'never',
				}))
				.sort(byName);
		}
		case 'interfaces':
			return description.interfaces
				.map((name): ExplorerMember => ({
					name,
					kind,
					type: null,
					signature: null,
					read: 'never',
				}))
				.sort(byName);
	}
}

/**
 * @description Takes one page of members whose names contain the filter, ignoring case.
 * @param members Every member of one kind.
 * @param page The page and filter.
 * @returns The page and how many members match in all.
 */
export function pageMembers(
	members: ExplorerMember[],
	{ offset, limit, filter }: ExplorerPage,
): MemberPage {
	const needle = filter?.toLowerCase();
	const matching = needle
		? members.filter((member) => member.name.toLowerCase().includes(needle))
		: members;

	return { members: matching.slice(offset, offset + limit), total: matching.length };
}

/**
 * @description Reads Java objects and classes through `java.describe` and `getField`, describing each class once and
 * paging its members here, since the bridge returns them all.
 * @param java The loader's unscoped Java bridge.
 * @param context The explorer's refs and the View Tree's handles.
 * @returns The Android explorer source.
 */
export function createAndroidExplorer(
	java: ReflectionBridge,
	{ objects, nodeHandle }: ExplorerContext,
): ExplorerSource {
	// Insertion order is use order, so the first entry is the least recently used.
	const cache = new Map<string, Described>();

	function described(name: string): Described {
		const cached = cache.get(name);

		if (cached) {
			cache.delete(name);
			cache.set(name, cached);

			return cached;
		}

		let description: NativeJavaClassDescription;

		try {
			description = java.describe(name);
		} catch (error) {
			throw explorerError(
				'unknown-class',
				`Failed to describe class ${name}: ${errorText(error)}`,
			);
		}

		const entry: Described = { description, members: {} };

		cache.set(name, entry);

		for (const oldest of cache.keys()) {
			if (cache.size <= DESCRIBED_CAPACITY) {
				break;
			}

			cache.delete(oldest);
		}

		return entry;
	}

	function toClass({
		name,
		fields,
		methods,
		constructors,
		interfaces,
	}: NativeJavaClassDescription) {
		return {
			name,
			image: null,
			instanceSize: null,
			counts: {
				fields: fields.length,
				methods: methods.length,
				constructors: constructors.length,
				interfaces: interfaces.length,
			},
		} satisfies ExplorerClass;
	}

	function chainOf(name: string): ExplorerClass[] {
		const chain: ExplorerClass[] = [];
		let current: string | null = name;

		while (current && chain.length < MAX_CHAIN) {
			const { description } = described(current);

			chain.push(toClass(description));
			current = description.superclass;
		}

		return chain;
	}

	function javaHandle(handle: ExplorerHandle | undefined): NativeJavaHandleValue | undefined {
		return handle && isJavaHandle(handle) ? handle : undefined;
	}

	/** Finds the object a target names, or throws `stale` when its node or ref is gone. */
	function targetHandle(target: { node: string } | { object: string }): NativeJavaHandleValue {
		const handle =
			'node' in target
				? javaHandle(nodeHandle(target.node))
				: javaHandle(objects.resolve(target.object));

		if (!handle) {
			throw explorerError(
				'stale',
				'node' in target
					? `View ${target.node} is gone; refresh the tree.`
					: `Object ${target.object} is gone; it was read before a reload or reconnect.`,
			);
		}

		return handle;
	}

	async function describeObject(handle: NativeJavaHandleValue): Promise<string | null> {
		try {
			const [text] = await java.batchAsync([
				{ op: 'invoke', handle, name: 'toString', args: [] },
			]);

			return clip(string(text)) || null;
		} catch {
			// A description is extra; an object whose toString throws still opens.
			return null;
		}
	}

	async function object(target: ExplorerTarget): Promise<ExplorerObject> {
		if ('className' in target) {
			const chain = chainOf(target.className);

			return {
				ref: null,
				className: chain[0]?.name ?? target.className,
				description: null,
				platform: 'android',
				chain,
			};
		}

		const handle = targetHandle(target);
		const className = string(java.className(handle));

		return {
			ref: objects.register(handle),
			className,
			description: await describeObject(handle),
			platform: 'android',
			chain: chainOf(className),
		};
	}

	async function members(className: string, kind: ExplorerMemberKind, page: ExplorerPage) {
		if (!isAndroidKind(kind)) {
			throw explorerError('unsupported', `Java classes have no ${kind}.`);
		}

		const entry = described(className);
		const listed = (entry.members[kind] ??= describeMembers(entry.description, kind));

		return pageMembers(listed, page);
	}

	function toValue(name: string, value: NativeJavaValue | undefined): ExplorerValue {
		if (!value || value.type === 'null') {
			return { name, kind: 'nil', text: 'null' };
		}

		switch (value.type) {
			case 'handle': {
				const className = string(java.className(value));

				return {
					name,
					kind: 'object',
					text: className,
					object: objects.register(value),
					className,
				};
			}
			case 'string':
			case 'char':
				return { name, kind: 'string', text: clip(value.value) };
			case 'boolean':
				return { name, kind: 'bool', text: String(value.value) };
			case 'array':
				return {
					name,
					kind: 'other',
					text: `${displayType(value.componentType)}[${value.value.length}]`,
				};
			default:
				return { name, kind: 'number', text: String(value.value) };
		}
	}

	function safeValue(name: string, value: NativeJavaValue | undefined): ExplorerValue {
		try {
			return toValue(name, value);
		} catch (error) {
			return { name, kind: 'error', text: errorText(error) };
		}
	}

	async function values(request: ExplorerValuesRequest): Promise<ExplorerValue[]> {
		if (request.kind !== 'fields') {
			throw explorerError('unsupported', `Only fields have values, not ${request.kind}.`);
		}

		const handle = targetHandle({ object: request.object });
		const read = (names: string[]) =>
			onMain(
				java,
				names.map((name) => ({ op: 'getField', handle, name })),
			);

		try {
			const results = await read(request.names);

			return request.names.map((name, index) => safeValue(name, results[index]));
		} catch {
			// One failing field rejects its whole batch, so each is read alone and only it reports the error.
		}

		const results: ExplorerValue[] = [];

		for (const name of request.names) {
			try {
				const [value] = await read([name]);

				results.push(safeValue(name, value));
			} catch (error) {
				results.push({ name, kind: 'error', text: errorText(error) });
			}
		}

		return results;
	}

	async function classes(): Promise<never> {
		throw explorerError('unsupported', 'Android cannot list its classes; open one by name.');
	}

	return { object, members, values, classes };
}

export default { createAndroidExplorer, describeMembers, displayType, pageMembers };
