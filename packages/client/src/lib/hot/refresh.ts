import type { FunctionComponent } from 'react';

import { findByPropsLazy } from '~/api/metro/wrappers';

/** Any function component; `never` props accept every component's props. */
export type Component = FunctionComponent<never>;

/** A `memo`, `forwardRef`, context or other React-tagged element type. */
export type ExoticType = { $$typeof: symbol };

/** What a fiber renders: a component, a React-tagged type, or a host component's name. */
export type FiberType = Component | ExoticType | string;

/** Picks the type a fiber should render after a hot update, or `null` to leave it alone. */
export type Resolve = (type: FiberType) => FiberType | null;

/** What a visitor of {@link reconcile} asks for a fiber: re-render it in place, remount it, or nothing. */
export type Decision = 'render' | 'remount' | null;

/** Decides what happens to one mounted fiber; it may change the fiber's type before answering. */
export type Visit = (fiber: Fiber) => Decision;

type Dispatch = (action: <S>(state: S) => S) => void;

type HookQueue = { dispatch?: Dispatch };

/** One entry of a function component's hook list, in call order. */
export type Hook = {
	memoizedState: unknown;
	queue: HookQueue | null;
	next: Hook | null;
};

/** A React fiber, reduced to the fields hot refresh and live patching read or write. */
export type Fiber = {
	tag: number;
	type: FiberType | null;
	elementType: FiberType | null;
	return: Fiber | null;
	child: Fiber | null;
	sibling: Fiber | null;
	alternate: Fiber | null;
	lanes: number;
	childLanes: number;
	memoizedProps: object | null;
	memoizedState: Hook | FiberRoot | null;
	stateNode: FiberRoot | null;
};

type FiberRoot = {
	current: Fiber;
	pendingLanes: number;
};

const Renderer = findByPropsLazy('getPublicInstanceFromRootTag');

const HOST_ROOT = 3;
const MEMO = 14;

/** Function, forwardRef and simple memo components: the fiber tags whose memoizedState is a hook list. */
export const HOOK_FIBERS = new Set([0, 11, 15]);

// React Native hands out root tags 1, 11, 21, ... as surfaces mount; this covers far more than Discord opens.
const MAX_ROOT_TAG = 200;

// A props key no component reads. `memo` fibers compare props shallowly, so a plain copy would let
// React render them and then throw the output away as unchanged.
const STALE_PROPS = '__hotRefresh';

// React's DefaultLane, the lane a state update outside an event is given. `schedule` corrects it from
// the root if this React build numbers lanes differently.
const DEFAULT_LANE = 0b100000;

// A type no element is ever created with. A fiber whose elementType is this no longer matches the
// element its parent renders, so React replaces it with a fresh mount on the parent's next render.
function Remounted() {
	return null;
}

/**
 * @description Visits every mounted fiber once, then re-renders or remounts the ones the visitor picks.
 * @param visit Decides each fiber; a re-rendered fiber keeps its state, a remounted one starts over.
 * @returns How many fibers were scheduled.
 */
export function reconcile(visit: Visit): number {
	let count = 0;

	for (const root of findRoots()) {
		const targets = new Set<Fiber>();

		for (const fiber of collect(root, (fiber) => Boolean(fiber.type))) {
			const decision = visit(fiber);
			const target = decision === 'remount' ? markForRemount(fiber) : decision && fiber;

			if (target) {
				targets.add(target);
				count++;
			}
		}

		schedule(root, [...targets]);
	}

	return count;
}

/**
 * @description Re-renders the mounted fibers a resolver picks, in place and keeping their state.
 * @param resolve Returns the type each fiber should now render, or `null` to skip it.
 * @returns How many fibers were scheduled.
 */
export function rerender(resolve: Resolve): number {
	return reconcile((fiber) => {
		const type = fiber.type && resolve(fiber.type);

		if (!type) return null;

		// Only `type` changes: parents still create elements of the old type, which React matches
		// against `elementType`, so the fiber is reused and renders the new function.
		for (const node of withAlternates([fiber])) {
			node.type = type;
		}

		return 'render';
	});
}

/**
 * @description Swaps a component for a new function in every mounted fiber and re-renders them, keeping their state.
 * @param previous The component currently mounted.
 * @param next The component to render in its place.
 * @returns How many fibers were swapped.
 */
export function refresh(previous: Component, next: Component): number {
	let count = 0;

	for (const root of findRoots()) {
		const fibers = collect(root, (fiber) => fiber.type === previous);

		for (const fiber of withAlternates(fibers)) {
			fiber.type = next;
			fiber.elementType = next;
		}

		schedule(root, fibers);
		count += fibers.length;
	}

	return count;
}

function findRoots() {
	const roots = new Set<FiberRoot>();

	for (let tag = 1; tag <= MAX_ROOT_TAG; tag++) {
		const root = hostRootOf(rootFiber(tag));

		if (root) {
			roots.add(root);
		}
	}

	return [...roots];
}

function rootFiber(tag: number): Fiber | undefined {
	try {
		return Renderer.getPublicInstanceFromRootTag(tag)?._documentElement?.firstElementChild
			?.__internalInstanceHandle;
	} catch {
		// Tags that never mounted a surface throw on some renderer versions.
		return void 0;
	}
}

function hostRootOf(fiber: Fiber | undefined) {
	let node = fiber;

	while (node && node.tag !== HOST_ROOT) node = node.return ?? void 0;

	return node?.stateNode ?? void 0;
}

function collect(root: FiberRoot, predicate: (fiber: Fiber) => boolean) {
	const found: Fiber[] = [];

	let node = root.current;

	while (true) {
		if (predicate(node)) {
			found.push(node);
		}

		if (node.child) {
			node = node.child;
			continue;
		}

		while (!node.sibling) {
			if (!node.return) {
				return found;
			}

			node = node.return;
		}

		node = node.sibling;
	}
}

// A memo fiber reuses its child whatever the child's elementType, so the memo fiber itself is the one replaced.
function markForRemount(fiber: Fiber) {
	let target = fiber;

	while (target.return?.tag === MEMO) target = target.return;

	if (!target.return) return null;

	for (const node of withAlternates([target])) {
		node.elementType = Remounted;
	}

	return target.return;
}

/**
 * @description Lists a fiber and, when it has one, its alternate: the pair React swaps between renders.
 * @param fibers The fibers to pair up.
 * @returns Every fiber followed by its alternate.
 */
export function withAlternates(fibers: Fiber[]): Fiber[] {
	return fibers.flatMap((fiber) => (fiber.alternate ? [fiber, fiber.alternate] : [fiber]));
}

// The props copy stops React bailing out of the re-render as if nothing changed. Host fibers
// reconcile their children from the lane alone, and a stray prop would reach the native view.
function mark(fibers: Fiber[], lane: number) {
	for (const fiber of withAlternates(fibers)) {
		fiber.lanes |= lane;

		if (typeof fiber.type !== 'string') {
			fiber.memoizedProps &&= { ...fiber.memoizedProps, [STALE_PROPS]: true };
		}

		for (let parent = fiber.return; parent; parent = parent.return) {
			parent.childLanes |= lane;

			if (parent.alternate) {
				parent.alternate.childLanes |= lane;
			}
		}
	}
}

function findDispatch(root: FiberRoot) {
	const [owner] = collect(root, (fiber) => Boolean(dispatchOf(fiber)));

	return owner ? { owner, dispatch: dispatchOf(owner) } : null;
}

function dispatchOf(fiber: Fiber): Dispatch | undefined {
	if (!HOOK_FIBERS.has(fiber.tag)) return;

	for (let hook = fiber.memoizedState as Hook | null; hook; hook = hook.next) {
		if (typeof hook.queue?.dispatch === 'function') {
			return hook.queue.dispatch;
		}
	}
}

// Marks the fibers, then dispatches a no-op state update so React schedules a render of the root.
// The kicking fiber is marked too, as an unmarked one would let React drop the no-op update eagerly.
function schedule(root: FiberRoot, fibers: Fiber[]) {
	if (!fibers.length) return;

	const kick = findDispatch(root);

	if (!kick?.dispatch) return;

	const targets = [...fibers, kick.owner];

	mark(targets, DEFAULT_LANE);

	const before = root.pendingLanes;

	kick.dispatch((state) => state);

	const requested = root.pendingLanes & ~before;
	const lane = requested & -requested;

	if (lane && lane !== DEFAULT_LANE) {
		mark(targets, lane);
	}
}

export default { HOOK_FIBERS, reconcile, rerender, refresh, withAlternates };
