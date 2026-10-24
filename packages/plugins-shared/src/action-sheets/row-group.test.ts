import { expect, test } from 'bun:test';

import { isActionSheetRowGroup } from './row-group';

function row(label: string) {
	return { type: {}, props: { label, onPress: () => undefined } };
}

test('recognizes a named ActionSheetRowGroup', () => {
	function ActionSheetRowGroup() {
		return null;
	}

	expect(isActionSheetRowGroup({ type: ActionSheetRowGroup, props: {} })).toBe(true);
});

test('recognizes anonymous Discord 347 action-sheet row groups', () => {
	const group = {
		type: {},
		props: { hasIcons: true, children: [row('Edit Message'), row('Reply')] },
	};

	expect(isActionSheetRowGroup(group)).toBe(true);
});

test('rejects anonymous groups whose children are not all rows', () => {
	const unrelated = { type: {}, props: { hasIcons: true, children: [{ type: {}, props: {} }] } };
	const empty = { type: {}, props: { hasIcons: true, children: [] } };
	const noFlag = { type: {}, props: { children: [row('Reply')] } };

	expect(isActionSheetRowGroup(unrelated)).toBe(false);
	expect(isActionSheetRowGroup(empty)).toBe(false);
	expect(isActionSheetRowGroup(noFlag)).toBe(false);
});
