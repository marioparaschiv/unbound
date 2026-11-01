import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { isElementNode } from '@unbound-plugins/shared/react/find-element';
import type { patcher } from '@unbound-app/api';

type Cleanup = () => void;
type Patcher = typeof patcher;
// UNKNOWN: a component may render any node.
type RenderFunction = (...args: never[]) => unknown;
// UNKNOWN: an action sheet may render any node.
type SheetVisitor = (result: unknown) => void;

const MAX_DEPTH = 15;

export type SheetRenderer = {
	// UNKNOWN: an action sheet may render any node.
	render: (result: unknown) => unknown;
	dispose: Cleanup;
};

/**
 * @description Follows an action sheet's render into the wrapper components that render after it, calling `visit` on each level, since the row group can sit several components deep.
 * @param Patcher The plugin's patcher.
 * @param visit Changes one rendered level in place, such as adding rows to the row group it finds.
 * @returns The renderer to call with the sheet's render result, and `dispose`, which removes the wrapper patches.
 */
export function createSheetRenderer(
	Patcher: Pick<Patcher, 'after'>,
	visit: SheetVisitor,
): SheetRenderer {
	const unpatches: Cleanup[] = [];
	const patchedOwners = new WeakSet<object>();
	const wrappers = new WeakMap<RenderFunction, RenderFunction>();
	const wrapped = new WeakSet<RenderFunction>();

	function wrap(type: RenderFunction, depth: number): RenderFunction {
		let wrapper = wrappers.get(type);

		if (!wrapper) {
			wrapper = (...args) => render(type(...args), depth + 1);
			wrappers.set(type, wrapper);
			wrapped.add(wrapper);
		}

		return wrapper;
	}

	// UNKNOWN: an action sheet may render any node.
	function render(result: unknown, depth: number = 0): unknown {
		visit(result);

		if (depth >= MAX_DEPTH || !isElementNode(result) || Array.isArray(result)) {
			return result;
		}

		if (typeof result.type === 'function') {
			if (!wrapped.has(result.type)) {
				result.type = wrap(result.type, depth);
			}

			return result;
		}

		const target = findRenderTarget(result, 'type');

		if (!target || patchedOwners.has(target.holder)) {
			return result;
		}

		patchedOwners.add(target.holder);
		unpatches.push(
			Patcher.after(target.holder, target.key, (context) =>
				render(context.result, depth + 1),
			),
		);

		return result;
	}

	return {
		render: (result) => render(result),
		dispose() {
			for (const unpatch of unpatches.splice(0)) unpatch();
		},
	};
}

export default createSheetRenderer;
