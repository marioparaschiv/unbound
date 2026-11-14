import { expect, test } from 'bun:test';

import { createSheetRenderer } from '~/action-sheets/sheet-renderer';
import { findElement, type ElementNode } from '~/react/find-element';
import { isActionSheetRowGroup } from '~/action-sheets/row-group';

const patcher = { after: () => () => undefined };

function row(label: string) {
	return { key: label, type: {}, props: { label, onPress: () => undefined } };
}

function GuildActionSheetSecondaryActions() {
	return {
		type: 'View',
		props: {
			children: [{ type: {}, props: { hasIcons: true, children: [row('Mark As Read')] } }],
		},
	};
}

function renderSheet() {
	return {
		type: 'View',
		props: { children: [{ type: GuildActionSheetSecondaryActions, props: {} }] },
	};
}

function addRow(label: string) {
	return (result: unknown) => {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

		if (Array.isArray(rows) && !rows.some((child: ElementNode) => child.key === label)) {
			rows.push(row(label));
		}
	};
}

function renderSection(sheet: ElementNode) {
	const section = (sheet.props?.children as ElementNode[] | undefined)?.[0];

	if (typeof section?.type !== 'function') throw new Error('section is not a component');

	return section.type();
}

test('two renderers on one sheet both add their rows to a nested section', () => {
	const first = createSheetRenderer(patcher, addRow('Hide Server'));
	const second = createSheetRenderer(patcher, addRow('View Permissions'));

	const sheet = second.render(first.render(renderSheet())) as ElementNode;
	const labels = findElement(renderSection(sheet), isActionSheetRowGroup)?.props?.children;

	expect((labels as ElementNode[]).map((child) => child.key)).toEqual([
		'Mark As Read',
		'Hide Server',
		'View Permissions',
	]);
});

test('a wrapped section keeps the component name', () => {
	const renderer = createSheetRenderer(patcher, () => undefined);
	const sheet = renderer.render(renderSheet()) as ElementNode;
	const section = (sheet.props?.children as ElementNode[] | undefined)?.[0];

	expect(typeof section?.type === 'function' && section.type.displayName).toBe(
		'GuildActionSheetSecondaryActions',
	);
});
