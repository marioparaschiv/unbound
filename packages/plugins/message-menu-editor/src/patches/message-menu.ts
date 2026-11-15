import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { isElementNode, type ElementNode } from '@unbound-plugins/shared/react/find-element';
import { metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { formatLabels, orderedPositions, parseLabels, withSeen } from '~/lib/menu-order';

const MAX_DEPTH = 8;

type Row = ElementNode & { props: { label: string } };

type FoundGroup = { group: ElementNode; siblings?: unknown[]; index: number };

function rowGroups(node: unknown, depth = 0, found: FoundGroup[] = []): FoundGroup[] {
	if (depth > MAX_DEPTH || !node || typeof node !== 'object') return found;

	if (Array.isArray(node)) {
		node.forEach((child, index) => {
			if (isActionSheetRowGroup(child)) found.push({ group: child, siblings: node, index });
			else rowGroups(child, depth + 1, found);
		});

		return found;
	}

	if (!isElementNode(node)) return found;

	const children = node.props?.children;

	if (isActionSheetRowGroup(node)) {
		found.push({ group: node, index: 0 });

		return found;
	}

	return rowGroups(children, depth + 1, found);
}

function isRow(node: unknown): node is Row {
	return isElementNode(node) && typeof node.props?.label === 'string';
}

function remember(labels: readonly string[]) {
	const next = withSeen(parseLabels(settings.seen), labels);

	// Writing settings while Discord renders the sheet would update the editor mid-render, so it waits a tick.
	if (next) setTimeout(() => (settings.seen = formatLabels(next)), 0);
}

// UNKNOWN: an action sheet may render any node.
function reorder(result: unknown): unknown {
	const found = rowGroups(result);
	const groups = found.map(({ group }) => group);
	const rows = groups.flatMap((group) =>
		Array.isArray(group.props?.children) ? group.props.children.filter(isRow) : [],
	);

	if (!groups.length || !rows.length) return result;

	const labels = rows.map((row) => row.props.label);

	remember(labels);

	const order = parseLabels(settings.order);
	const hidden = new Set(parseLabels(settings.hidden));

	if (!order.length && !hidden.size) return result;

	const [first, ...rest] = found;

	first!.group.props!.children = orderedPositions(labels, order, hidden).map(
		(index) => rows[index],
	);

	// The rows now all live in the first group; the others are dropped so they draw no empty cards.
	for (const { group, siblings, index } of rest.toReversed()) {
		if (siblings) siblings.splice(index, 1);
		else group.props!.children = [];
	}

	return result;
}

/**
 * @description Reorders and hides the rows of the message long-press menu as the user arranged them, and remembers every row it sees for the editor.
 */
export function patchMessageMenu(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Message menu skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets(patcher, ActionSheets, (key) =>
		key.endsWith('MessageLongPressActionSheet') ? reorder : undefined,
	);
}

export default patchMessageMenu;
