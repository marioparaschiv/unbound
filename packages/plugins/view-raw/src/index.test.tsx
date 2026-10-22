import { expect, mock, test } from 'bun:test';

mock.module('@unbound-app/api', () => ({
	metro: {},
	patcher: { createPatcher: () => ({}) },
	toasts: {},
}));

const { isActionSheetRowGroup } = await import('./index');

test('recognizes anonymous Discord 347 action-sheet row groups', () => {
	const row = (label: string) => ({ type: {}, props: { label, onPress: () => undefined } });
	const group = {
		type: {},
		props: { hasIcons: true, children: [row('Edit Message'), row('Reply')] },
	};
	const unrelated = { type: {}, props: { hasIcons: true, children: [{ type: {}, props: {} }] } };

	expect(isActionSheetRowGroup(group)).toBe(true);
	expect(isActionSheetRowGroup(unrelated)).toBe(false);
});
