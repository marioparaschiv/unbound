import type { View } from 'react-native';

import type { HostProps } from './element-colors';

declare const shadowNode: unique symbol;

/** Fabric's opaque shadow node, read only by the UI manager. The brand keeps other values out. */
type ShadowNode = { readonly [shadowNode]: true };

/** A host fiber's instance. Both alternates share `canonical`, which holds the last committed props. */
type HostInstance = {
	node?: ShadowNode;
	canonical?: { currentProps?: HostProps };
};

/** The parts of a React fiber the search reads. */
type Fiber = {
	tag: number;
	return: Fiber | null;
	child: Fiber | null;
	sibling: Fiber | null;
	memoizedProps: HostProps | null;
	stateNode: (HostInstance & { current?: Fiber }) | null;
};

/** A React tree's root. `current` always points at the last committed tree. */
export type FiberRoot = { current: Fiber };

type FabricUIManager = {
	findNodeAtPoint?: (
		node: ShadowNode,
		x: number,
		y: number,
		callback: (handle: Fiber | null) => void,
	) => void;
};

const HOST_ROOT = 3;
const HOST_COMPONENT = 5;
/** Enough ancestors to reach the screen behind any element. */
const MAX_ANCESTORS = 200;

function fabricUIManager(): FabricUIManager | undefined {
	// A `string` key skips the debugger's narrower declaration of this global.
	const name: string = 'nativeFabricUIManager';

	return Reflect.get(globalThis, name);
}

function isRoot(node: Fiber['stateNode'] | undefined): node is HostInstance & FiberRoot {
	return Boolean(node?.current);
}

function fiberOf(instance: View): Fiber | undefined {
	// Fabric's element calls it `__internalInstanceHandle`; the older host component, `_internalInstanceHandle`.
	return (
		Reflect.get(instance, '__internalInstanceHandle') ??
		Reflect.get(instance, '_internalInstanceHandle')
	);
}

/**
 * @description Finds a mounted view's React tree, which stays searchable after the view unmounts.
 * @param instance The view's ref.
 * @returns The tree's root, or `undefined` off Fabric.
 */
export function rootOf(instance: View): FiberRoot | undefined {
	let fiber = fiberOf(instance);

	while (fiber && fiber.tag !== HOST_ROOT) fiber = fiber.return ?? undefined;

	const root = fiber?.stateNode;

	return isRoot(root) ? root : undefined;
}

function firstHost(fiber: Fiber | null): Fiber | undefined {
	for (let node = fiber; node; node = node.sibling) {
		if (node.tag === HOST_COMPONENT) {
			return node;
		}

		const found = firstHost(node.child);

		if (found) {
			return found;
		}
	}

	return undefined;
}

function propsOf(fiber: Fiber): HostProps {
	return fiber.stateNode?.canonical?.currentProps ?? fiber.memoizedProps ?? {};
}

function hostChain(fiber: Fiber): HostProps[] {
	const chain: HostProps[] = [];

	for (let node: Fiber | null = fiber; node && chain.length < MAX_ANCESTORS; node = node.return) {
		if (node.tag === HOST_COMPONENT) {
			chain.push(propsOf(node));
		}
	}

	return chain;
}

/**
 * @description Finds the topmost element at a point, the way Fabric hit-tests touches.
 * @param root The tree to search, from {@link rootOf}.
 * @param x The point's distance from the window's left edge.
 * @param y The point's distance from the window's top edge.
 * @returns The element's props, then each ancestor's; `undefined` off Fabric or when nothing is there.
 */
export function elementAt(root: FiberRoot, x: number, y: number): Promise<HostProps[] | undefined> {
	const manager = fabricUIManager();
	const node = firstHost(root.current.child)?.stateNode?.node;

	return new Promise((resolve) => {
		if (!manager?.findNodeAtPoint || !node) {
			resolve(undefined);

			return;
		}

		manager.findNodeAtPoint(node, x, y, (handle) =>
			resolve(handle ? hostChain(handle) : undefined),
		);
	});
}
