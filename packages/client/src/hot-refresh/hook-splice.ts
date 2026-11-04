import { canInsertHooks, hookList, runWithBudget, spliceHooks } from '~/hot-refresh/hooks';
import type { Component, Fiber, FiberType } from '~/hot-refresh/refresh';
import type { HookPlan } from '~/hot-refresh/hook-diff';
import { fitPlan } from '~/hot-refresh/hook-diff';

const originals = new WeakMap<WeakKey, FiberType>();

/**
 * @description Applies a hook-order change to one mounted fiber in place: removes the hooks the new version
 * dropped now, and returns a render that inserts the hooks it added on its next render.
 * @param fiber The mounted fiber, from the committed tree.
 * @param render The component's new version.
 * @param plan How the new hook list maps onto the old one.
 * @returns The type to render the fiber with, or `null` when the plan doesn't fit its hook list.
 */
export function splicePlanned(fiber: Fiber, render: Component, plan: HookPlan): Component | null {
	const splice = fitPlan(plan, hookList(fiber).length);

	if (!splice || (splice.insert && !canInsertHooks())) return null;

	if (splice.remove) {
		spliceHooks(fiber, splice.start, splice.remove);
	}

	if (!splice.insert) {
		return render;
	}

	const { start, insert } = splice;
	const spliced = hookList(fiber).length;

	// React clears the work-in-progress fiber's hook list before rendering it, so the fiber still holding a
	// list is the committed one; once it holds the inserted hooks, every later render is a plain one.
	function planned(...args: Parameters<Component>) {
		const committed = fiber.memoizedState ? fiber : fiber.alternate;

		if (hookList(committed).length !== spliced) {
			return render(...args);
		}

		const budget = { limit: start, used: 0, unknown: false, strict: false, insert };

		return runWithBudget(budget, () => render(...args));
	}

	Object.defineProperty(planned, 'name', { value: render.name });
	originals.set(planned, render);

	return planned;
}

/**
 * @description Maps a type {@link splicePlanned} returned back to the component it renders.
 * @param type A fiber's type.
 * @returns The component behind a planned render, otherwise `type`.
 */
export function unplanned(type: FiberType): FiberType {
	return (typeof type === 'function' && originals.get(type)) || type;
}

export default { splicePlanned, unplanned };
