import { describe, expect, test } from 'bun:test';
import { flux, logs, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { StoreSeeds } from '@unbound-app/api/testing';

const USER_ROW_PATH = 'modules/main_tabs_v2/native/shared_components/user_list/UserRow.tsx';
const PROFILE_PATH = 'modules/user_profile/native/UserProfilePrimaryInfo.tsx';

function TableRow({ label }: { label?: ReactNode }) {
	return <Text>{label}</Text>;
}

function userRow({ user }: { user: { id: string } }) {
	return <TableRow label={user.id} />;
}

const stores: StoreSeeds = {
	Presence: { getClientStatus: () => ({ desktop: 'online', mobile: 'idle' }) },
	Sessions: { getSessions: () => ({}) },
	User: { getCurrentUser: () => ({ id: '1' }) },
	Theme: { theme: 'dark' },
};

const rowModule = { default: userRow };

function warnings() {
	return logs.entries.filter(({ level }) => level === 'warn' || level === 'error');
}

async function start({ profile = () => <View />, isMobileOnline = true } = {}) {
	flux.seed({
		...stores,
		Presence: {
			...stores.Presence,
			...(isMobileOnline ? { isMobileOnline: () => false } : {}),
		},
	});
	metro.register({ colors: { STATUS_ONLINE: 'x' }, internal: {} });
	metro.register({ getLanguages: () => [], getSystemLocale: () => 'en-US', intl: {} });
	metro.register({ Svg: View, Path: View });
	metro.register(rowModule, USER_ROW_PATH);
	metro.register({ default: profile }, PROFILE_PATH);
	metro.register({ generateMessageRowData: () => ({ message: {} }) });
	await startPlugin();
}

describe('starting', () => {
	test('reports every feature applied to the self test', async () => {
		await start();

		expect(warnings()).toEqual([]);
		await stopPlugin();
	});

	test('fails the start when a feature cannot be patched', async () => {
		await expect(start({ profile: 'not a component' as never })).rejects.toThrow(
			'Failed to patch component',
		);
	});

	test('skips the mobile shape when Discord has no isMobileOnline', async () => {
		await start({ isMobileOnline: false });

		expect(warnings()).toEqual([
			{
				level: 'warn',
				args: ['Mobile status skipped: Discord moved PresenceStore.isMobileOnline.'],
			},
		]);
		await stopPlugin();
	});

	test('skips the member list with one warning when Discord moved UserRow', async () => {
		metro.markMissing(USER_ROW_PATH);
		await start();

		expect(warnings()).toEqual([
			{ level: 'warn', args: ['Member list skipped: Discord moved UserRow or Theme.'] },
		]);
		await stopPlugin();
	});
});
