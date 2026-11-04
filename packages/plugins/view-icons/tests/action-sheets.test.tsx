import { render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { View } from 'react-native';

import type { ReactNode } from 'react';

import { ActionSheetRow, ActionSheets, hidden, registerDiscord } from './discord';

function ActionSheetRowGroup({ children }: { children?: ReactNode }) {
	return <View>{children}</View>;
}

function ProfileSheet() {
	return (
		<ActionSheetRowGroup>
			{[<ActionSheetRow key='message' label='Message' />]}
		</ActionSheetRowGroup>
	);
}

const sheet = { default: ProfileSheet };

async function openSheet(key: string) {
	ActionSheets.openLazy(Promise.resolve(sheet), key, { userId: '1' });
	await Promise.resolve();
}

beforeEach(async () => {
	registerDiscord();
	await startPlugin();
});

describe('the View rows in a profile sheet', () => {
	test('follow the sheet’s own rows, one per image the user has', async () => {
		await openSheet('UserProfileActionSheet');

		const rows = render(<sheet.default />).findAll('Text');

		expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
			'Message',
			'View Avatar',
			'View Banner',
		]);
	});

	test('close the sheet when a row is pressed', async () => {
		await openSheet('UserProfileActionSheet');

		const view = render(<sheet.default />);

		view.act(() => view.findAll('Text')[1]?.props.onPress?.(Object.create(null)));

		expect(hidden).toContain('UserProfileActionSheet');
	});

	test('stay out of other sheets', async () => {
		await openSheet('SomeOtherSheet');

		expect(render(<sheet.default />).findAll('Text')).toHaveLength(1);
	});
});
