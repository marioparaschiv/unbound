import type {
	LoaderObjCBridge,
	NativeInspectKind,
	NativeInspectedClass,
	NativeInspectedMember,
	NativeInspectedValue,
	NativeInspectPage,
	NativeObjCInspector,
	NativeObjectHandle,
} from '@unbound-app/types';
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
	ClassPage,
	ExplorerContext,
	ExplorerPage,
	ExplorerSource,
} from '~/debugger/explorer.dev';
import { isJavaHandle, type ExplorerHandle } from '~/debugger/explorer-objects.dev';
import { explorerError } from '~/debugger/explorer-errors.dev';
import { asText } from '~/debugger/objc-values.dev';

const IOS_KINDS: ReadonlySet<ExplorerMemberKind> = new Set<NativeInspectKind>([
	'properties',
	'ivars',
	'methods',
	'classMethods',
	'protocols',
]);
const MAX_DESCRIPTION_LENGTH = 500;

function isIosKind(kind: ExplorerMemberKind): kind is NativeInspectKind {
	return IOS_KINDS.has(kind);
}

/** The Objective-C bridge methods the explorer reads with; the inspector's are absent on an older loader. */
type InspectorBridge = Pick<LoaderObjCBridge, 'className' | 'invokeAsync'> &
	Partial<NativeObjCInspector>;

function hasInspector(objc: InspectorBridge): objc is InspectorBridge & NativeObjCInspector {
	return (
		typeof objc.inspectClass === 'function' &&
		typeof objc.inspectMembers === 'function' &&
		typeof objc.inspectValues === 'function' &&
		typeof objc.inspectImages === 'function' &&
		typeof objc.inspectClasses === 'function'
	);
}

function inspectPage({ offset, limit, filter }: ExplorerPage): NativeInspectPage {
	return filter ? { offset, limit, filter } : { offset, limit };
}

/**
 * @description Maps one class of an inspected chain to the protocol's shape.
 * @param inspected The loader's class.
 * @returns The explorer class.
 */
export function toExplorerClass(inspected: NativeInspectedClass): ExplorerClass {
	return {
		name: inspected.name,
		image: inspected.image ?? null,
		instanceSize: inspected.instanceSize ?? null,
		counts: { ...inspected.counts },
	};
}

/**
 * @description Maps an inspected member to the protocol's shape, keeping only the fields it has.
 * @param member The loader's member.
 * @returns The explorer member.
 */
export function toExplorerMember(member: NativeInspectedMember): ExplorerMember {
	const mapped: ExplorerMember = {
		name: member.name,
		kind: member.kind,
		type: member.type ?? member.returnType ?? null,
		signature: member.signature ?? null,
		read: member.read,
	};

	if (member.returnType !== undefined) {
		mapped.returnType = member.returnType;
	}

	if (member.parameters) {
		mapped.parameters = member.parameters;
	}

	if (member.attributes) {
		mapped.attributes = member.attributes;
	}

	if (member.offset !== undefined) {
		mapped.offset = member.offset;
	}

	if (member.size !== undefined) {
		mapped.size = member.size;
	}

	if (member.image !== undefined) {
		mapped.image = member.image;
	}

	if (member.kind === 'classMethods' || member.attributes?.includes('class')) {
		mapped.static = true;
	}

	return mapped;
}

/**
 * @description Reads Objective-C objects and classes through the loader's inspector, which loads on first use.
 * @param objc The loader's unscoped Objective-C bridge.
 * @param context The explorer's refs and the View Tree's handles.
 * @returns The iOS explorer source.
 */
export function createIosExplorer(
	objc: InspectorBridge,
	{ objects, nodeHandle }: ExplorerContext,
): ExplorerSource {
	/** The inspector, or an `unsupported` error when this loader predates it. */
	function inspector(): NativeObjCInspector {
		if (!hasInspector(objc)) {
			throw explorerError(
				'unsupported',
				'This loader has no Objective-C inspector; update the loader.',
			);
		}

		return objc;
	}

	function objectHandle(handle: ExplorerHandle | undefined): NativeObjectHandle | undefined {
		return handle && !isJavaHandle(handle) ? handle : undefined;
	}

	/** Finds the object a target names, or throws `stale` when its node or ref is gone. */
	function targetHandle(target: { node: string } | { object: string }): NativeObjectHandle {
		const handle =
			'node' in target
				? objectHandle(nodeHandle(target.node))
				: objectHandle(objects.resolve(target.object));

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

	async function describe(handle: NativeObjectHandle): Promise<string | null> {
		try {
			const text = asText(await objc.invokeAsync(handle, 'description', []));

			return text.length > MAX_DESCRIPTION_LENGTH
				? `${text.slice(0, MAX_DESCRIPTION_LENGTH)}…`
				: text || null;
		} catch {
			// A description is extra; an object whose -description throws still opens.
			return null;
		}
	}

	async function object(target: ExplorerTarget): Promise<ExplorerObject> {
		const inspect = inspector();

		if ('className' in target) {
			const chain = inspect.inspectClass(target.className).map(toExplorerClass);

			return {
				ref: null,
				className: chain[0]?.name ?? target.className,
				description: null,
				platform: 'ios',
				chain,
			};
		}

		const handle = targetHandle(target);
		const chain = inspect.inspectClass(handle).map(toExplorerClass);

		return {
			ref: objects.register(handle),
			className: chain[0]?.name ?? objc.className(handle) ?? 'NSObject',
			description: await describe(handle),
			platform: 'ios',
			chain,
		};
	}

	async function members(className: string, kind: ExplorerMemberKind, page: ExplorerPage) {
		if (!isIosKind(kind)) {
			throw explorerError('unsupported', `Objective-C classes have no ${kind}.`);
		}

		const listed = inspector().inspectMembers(className, kind, inspectPage(page));

		return { members: listed.members.map(toExplorerMember), total: listed.total };
	}

	function toValue(value: NativeInspectedValue): ExplorerValue {
		const mapped: ExplorerValue = { name: value.name, kind: value.kind, text: value.text };

		if (value.object) {
			mapped.object = objects.register(value.object);
		}

		if (value.className !== undefined) {
			mapped.className = value.className;
		}

		return mapped;
	}

	async function values(request: ExplorerValuesRequest): Promise<ExplorerValue[]> {
		const { kind, className, names, invokeGetters = false } = request;

		if (kind !== 'properties' && kind !== 'ivars') {
			throw explorerError(
				'unsupported',
				`Only properties and ivars have values, not ${kind}.`,
			);
		}

		const inspect = inspector();
		const handle = targetHandle({ object: request.object });
		const read = await inspect.inspectValues(handle, className, kind, names, { invokeGetters });

		return read.map(toValue);
	}

	async function classes(image: string | undefined, page: ExplorerPage): Promise<ClassPage> {
		const inspect = inspector();

		return image === undefined
			? inspect.inspectImages(inspectPage(page))
			: inspect.inspectClasses(image, inspectPage(page));
	}

	return { object, members, values, classes };
}

export default { createIosExplorer, toExplorerClass, toExplorerMember };
