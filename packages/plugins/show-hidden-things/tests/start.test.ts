import { logs, metro, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

const InvitePermissions = { useInvitesDisabledPermission: () => false };

// A module Discord changed so that its method cannot be read, which a patch on it throws on.
const BrokenMessageRowData = {
	get generateMessageRowData(): never {
		throw new Error('The row module changed shape.');
	},
};

describe('the plugin on start', () => {
	test('starts both features without a warning, so its self-test passes', async () => {
		metro.register({ generateMessageRowData: () => ({ message: {} }) });
		metro.register(InvitePermissions);
		await startPlugin();

		expect(InvitePermissions.useInvitesDisabledPermission()).toBe(true);
		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});

	test('fails to start when a patch throws', async () => {
		metro.register(BrokenMessageRowData);
		metro.register(InvitePermissions);

		await expect(startPlugin()).rejects.toThrow('The row module changed shape.');
	});
});
