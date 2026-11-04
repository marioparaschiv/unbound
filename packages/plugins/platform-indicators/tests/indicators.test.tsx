import { beforeEach, describe, expect, test } from 'bun:test';
import { flux, metro, render, setLocale, startPlugin } from '@unbound-app/api/testing';
import { flux as unbound } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { createElement, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { StoreSeeds } from '@unbound-app/api/testing';

const USER_ROW_PATH = 'modules/main_tabs_v2/native/shared_components/user_list/UserRow.tsx';
const PROFILE_PATH = 'modules/user_profile/native/UserProfilePrimaryInfo.tsx';

let presence = { desktop: 'online', mobile: 'idle' } as Record<string, string> | null;

const stores: StoreSeeds = {
	Presence: { getClientStatus: () => presence, isMobileOnline: () => false },
	Sessions: { getSessions: () => ({}) },
	User: { getCurrentUser: () => ({ id: '1' }) },
	Theme: { theme: 'dark' },
};

function TableRow({ label }: { label?: ReactNode }) {
	return <Text>{label}</Text>;
}

const discord = {
	getLanguages: () => [],
	getSystemLocale: () => 'en-US',
	intl: { currentLocale: 'en-US' },
};

const userRow = { default: ({ user }: { user: { id: string } }) => <TableRow label={user.id} /> };
const profile = { default: () => <View /> };
const rowData = {
	generateMessageRowData: (_options: { message: object }) => ({
		message: { timestamp: 'Today at 12:00', timestampAccessibilityLabel: 'Today at 12:00' },
	}),
};

beforeEach(async () => {
	flux.seed(stores);
	presence = { desktop: 'online', mobile: 'idle' };
	discord.intl.currentLocale = 'en-US';
	metro.register({ colors: { STATUS_ONLINE: 'x' }, internal: {} });
	metro.register(discord);
	metro.register({ Svg: View, Path: View });
	metro.register(userRow, USER_ROW_PATH);
	metro.register(profile, PROFILE_PATH);
	metro.register(rowData);
	await startPlugin();
});

function labels(view: ReturnType<typeof render>) {
	return view
		.findAll((node) => typeof node.props.accessibilityLabel === 'string')
		.map((node) => node.props.accessibilityLabel);
}

describe('the member list', () => {
	test('shows where a user is online after their name', () => {
		const view = render(createElement(userRow.default, { user: { id: 'wumpus' } }), { stores });

		expect(view.text()).toContain('wumpus');
		expect(labels(view)).toEqual(['Online on Desktop and Mobile']);
	});

	test('shows nothing when Member List is off', () => {
		const view = render(createElement(userRow.default, { user: { id: 'wumpus' } }), {
			stores,
			settings: { memberList: false },
		});

		expect(labels(view)).toEqual([]);
	});
});

describe('the screen-reader list', () => {
	test('follows the language of the plugin', () => {
		setLocale('de');

		const view = render(createElement(userRow.default, { user: { id: 'wumpus' } }), { stores });

		expect(labels(view)).toEqual(['Online on Desktop und Mobile']);
	});
});

describe('profiles', () => {
	test('show a button per platform under the name', () => {
		const view = render(createElement(profile.default, { user: { id: '2' } }), { stores });

		expect(labels(view)).toContain('Online on Desktop and Mobile');
		expect(view.findAll('Pressable').map((node) => node.props.accessibilityLabel)).toEqual([
			'Desktop',
			'Mobile',
		]);
	});
});

describe('the mobile status shape', () => {
	function isMobileOnline(userId: string) {
		return unbound.getStore('Presence').isMobileOnline(userId);
	}

	test('shows for a user on mobile who is not online', () => {
		presence = { mobile: 'idle' };

		expect(isMobileOnline('2')).toBe(true);
	});

	test('stays hidden for a user who is online on desktop', () => {
		expect(isMobileOnline('2')).toBe(false);
	});

	test('stays as Discord drew it when Color Mobile Indicator is off', () => {
		presence = { mobile: 'idle' };
		settings.colorMobileIndicator = false;

		expect(isMobileOnline('2')).toBe(false);
	});
});

describe('messages', () => {
	const message = { type: 0, author: { id: '2' } };

	test('end the timestamp with the author’s platforms', () => {
		expect(rowData.generateMessageRowData({ message }).message).toMatchObject({
			timestamp: 'Today at 12:00 • 🖥️📱',
			timestampAccessibilityLabel: 'Today at 12:00 • Online on Desktop and Mobile',
		});
	});

	test('join the list in the language Discord shows', () => {
		discord.intl.currentLocale = 'de';

		expect(
			rowData.generateMessageRowData({ message }).message.timestampAccessibilityLabel,
		).toBe('Today at 12:00 • Online on Desktop und Mobile');
	});

	test('stay as they were when Messages is off', () => {
		settings.messages = false;

		expect(rowData.generateMessageRowData({ message }).message.timestamp).toBe(
			'Today at 12:00',
		);
	});

	test('leave bots alone', () => {
		expect(
			rowData.generateMessageRowData({
				message: { ...message, author: { id: '3', bot: true } },
			}).message.timestamp,
		).toBe('Today at 12:00');
	});
});

describe('the settings panel', () => {
	test('has a switch for each setting, under two headings', async () => {
		const { SettingsPanel } = await import('~/settings');
		const view = render(createElement(SettingsPanel));

		expect(view.findAll('Section').map((node) => node.props.title)).toEqual([
			'Show Indicators',
			'Status',
		]);
		expect(view.findAll('SwitchRow').map((node) => node.props.label)).toHaveLength(4);
	});
});
