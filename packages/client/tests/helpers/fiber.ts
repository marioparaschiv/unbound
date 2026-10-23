import type { Fiber, Hook } from '~/lib/hot/refresh';

/**
 * @description Creates a detached function-component fiber holding a hook list.
 * @param hooks The first hook of its list, or `null` for none.
 * @returns The fiber.
 */
export function createFiber(hooks: Hook | null = null): Fiber {
	return {
		tag: 0,
		type: null,
		elementType: null,
		return: null,
		child: null,
		sibling: null,
		alternate: null,
		lanes: 0,
		childLanes: 0,
		memoizedProps: null,
		memoizedState: hooks,
		stateNode: null,
	};
}

export default { createFiber };
