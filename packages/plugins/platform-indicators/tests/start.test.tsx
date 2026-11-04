import { describe, expect, spyOn, test } from 'bun:test';
import { flux, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { createElement, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { StoreSeeds } from '@unbound-app/api/testing';

import { selfTest } from '~/index';

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

async function start({ profile = () => <View />, isMobileOnline = true } = {}) {
	resetHealth();
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

		expect(selfTest()).toEqual({ ok: true, detail: '4 features applied' });
		await stopPlugin();
	});

	test('keeps the other features when one cannot start', async () => {
		const errors = spyOn(console, 'error').mockImplementation(() => {});

		await start({ profile: 'not a component' as never });
		errors.mockRestore();

		const row = render(createElement(rowModule.default, { user: { id: 'wumpus' } }), {
			stores,
		});

		expect(
			row.findAll((node) => typeof node.props.accessibilityLabel === 'string'),
		).toHaveLength(1);
		expect(selfTest()).toMatchObject({
			ok: false,
			detail: expect.stringContaining('Failed to patch component'),
		});
		await stopPlugin();
	});

	test('skips the mobile shape when Discord has no isMobileOnline', async () => {
		await start({ isMobileOnline: false });

		expect(selfTest()).toMatchObject({
			ok: false,
			detail: expect.stringContaining('isMobileOnline'),
		});
		await stopPlugin();
	});
});
