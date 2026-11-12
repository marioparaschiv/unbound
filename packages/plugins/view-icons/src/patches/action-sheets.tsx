import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import {
	findElement,
	getElementName,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { assets, metro, patcher } from '@unbound-app/api';

import { openedSheet, toOpenedSheet, type SheetProps } from '~/lib/opened-sheet';
import { SHEET_SECTIONS } from '~/lib/constants';
import { getSheetTargets } from '~/lib/targets';
import { IconUtils, Media } from '~/lib/modules';
import { openImage } from '~/lib/open-image';
import { viewLabel } from '~/lib/labels';

// UNKNOWN: a component may render any node.
type RenderFunction = (...args: never[]) => unknown;

/**
 * @description Adds View rows for avatars, banners and icons to user profile and guild action sheets.
 * Patches `openLazy` on Discord's action sheet module, and the render of each profile and guild sheet it opens.
 * Records the last opened profile or guild sheet in `openedSheet`.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;
	const icons = IconUtils;

	if (!ActionSheets || !icons || !Media) {
		logger.warn('Action sheets skipped: Discord moved ActionSheets, IconUtils or Media.');

		return;
	}

	const sheetTargets = () => getSheetTargets(icons, openedSheet.current);
	const patchedHolders = new WeakSet<object>();

	// UNKNOWN: an action sheet may render any node.
	function addRows(result: unknown, sheetKey: string) {
		const group = findElement(
			result,
			(element) => getElementName(element) === 'ActionSheetRowGroup',
		);
		const rows = group?.props?.children;

		if (!Array.isArray(rows)) return;

		const ActionSheetRow = getActionSheetRow();
		const iconId = assets.getIdByName('ImageIcon');
		const added = [];

		for (const target of sheetTargets()) {
			const label = viewLabel(target.kind);
			const key = `unbound-view-icons-${target.kind}`;

			if (rows.some((row) => isElementNode(row) && row.key === key)) {
				continue;
			}

			added.push(
				<ActionSheetRow
					key={key}
					label={label}
					icon={iconId != null ? <ActionSheetRow.Icon source={iconId} /> : undefined}
					onPress={() => {
						ActionSheets.hideActionSheet(sheetKey);
						openImage(target);
					}}
				/>,
			);
		}

		rows.splice(1, 0, ...added);
	}

	function createRenderer(sheetKey: string) {
		// A plain function section is swapped for a wrapper, cached so every render reuses the same component.
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

		function patchSection(element: ElementNode, depth: number) {
			if (typeof element.type === 'function') {
				if (!wrapped.has(element.type)) element.type = wrap(element.type, depth);

				return;
			}

			const target = findRenderTarget(element, 'type');

			if (!target || patchedHolders.has(target.holder)) return;

			patchedHolders.add(target.holder);
			patcher.after(target.holder, target.key, ({ result }) => render(result, depth + 1));
		}

		// UNKNOWN: an action sheet may render any node.
		function patchSections(node: unknown, depth: number) {
			if (depth >= 15 || !isElementNode(node)) return;

			if (Array.isArray(node)) {
				for (const child of node) patchSections(child, depth + 1);

				return;
			}

			if (SHEET_SECTIONS.has(getElementName(node) ?? '')) {
				patchSection(node, depth);
			}

			patchSections(node.props?.children, depth + 1);
		}

		// UNKNOWN: an action sheet may render any node.
		function render(result: unknown, depth: number = 0): unknown {
			addRows(result, sheetKey);
			patchSections(result, depth);

			return result;
		}

		return render;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const sheet = toOpenedSheet(key, props);

		if (sheet === undefined) return;

		openedSheet.current = sheet;

		const render = createRenderer(key);

		return (result) => render(result);
	});
}

export default patchActionSheets;
