import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { findElement, isElementNode } from '@unbound-plugins/shared/react/find-element';
import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';

import { getRawItem, type RawItem, type SheetProps } from '~/raw-items';
import { ActionSheets, Patcher } from '~/modules';
import RawIcon from '~/components/raw-icon';
import { openRawSheet } from '~/sheets';

type Cleanup = () => void;
// UNKNOWN: a component may render any node.
type RenderFunction = (...args: never[]) => unknown;

type OpenSheet = {
	key: string;
	item: RawItem;
};

/** What the action sheet patch last saw, read by the context menu patch. */
export type SheetState = {
	open: OpenSheet | null;
	profileUserId: string | null;
};

/**
 * @description Adds a View Raw row to the message, profile, channel and guild action sheets.
 * @param state Where the patch records the open sheet for the context menu patch.
 * @returns A function that removes the row and every sheet patch.
 */
export function patchActionSheets(state: SheetState): Cleanup {
	const unpatches: Cleanup[] = [];
	const patchedOwners = new WeakSet<object>();

	// UNKNOWN: an action sheet may render any node.
	function addRow(result: unknown) {
		const { open } = state;

		if (!open) return;

		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

		if (
			!Array.isArray(rows) ||
			rows.some((row) => isElementNode(row) && row.key === 'unbound-view-raw')
		) {
			return;
		}

		const ActionSheetRow = getActionSheetRow();

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key='unbound-view-raw'
				label='View Raw'
				icon={<RawIcon />}
				onPress={() => {
					ActionSheets.hideActionSheet(open.key);
					openRawSheet(open.item);
				}}
			/>,
		);
	}

	// The row group can sit inside wrapper components that render after the sheet, so each wrapper is patched as it appears.
	function createRenderer() {
		// A plain function component is swapped for a wrapper, cached so every render reuses the same component.
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
			addRow(result);

			if (depth >= 15 || !isElementNode(result) || Array.isArray(result)) return result;

			if (typeof result.type === 'function') {
				if (!wrapped.has(result.type)) result.type = wrap(result.type, depth);

				return result;
			}

			const target = findRenderTarget(result, 'type');

			if (!target || patchedOwners.has(target.holder)) return result;

			patchedOwners.add(target.holder);
			unpatches.push(
				Patcher.after(target.holder, target.key, (ctx) => render(ctx.result, depth + 1)),
			);

			return result;
		}

		return render;
	}

	const unpatchSheets = patchLazySheets<SheetProps>(Patcher, ActionSheets, (key, props) => {
		if (key.startsWith('UserProfile') && typeof props.userId === 'string') {
			state.profileUserId = props.userId;
		}

		const item = getRawItem(key, props);

		state.open = item ? { key, item } : null;

		if (!item) return;

		const render = createRenderer();

		return (result) => render(result);
	});

	return () => {
		unpatchSheets();

		for (const unpatch of unpatches.splice(0)) unpatch();
	};
}

export default patchActionSheets;
