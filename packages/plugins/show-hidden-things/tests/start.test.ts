import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { selfTest } from '~/index';

const InvitePermissions = { useInvitesDisabledPermission: () => false };

// A module Discord changed so that its method cannot be read, which a patch on it throws on.
const BrokenMessageRowData = {
	get generateMessageRowData(): never {
		throw new Error('The row module changed shape.');
	},
};

beforeEach(() => resetHealth());

describe('the plugin on start', () => {
	test('reports both features in its self-test', async () => {
		metro.register({ generateMessageRowData: () => ({ message: {} }) });
		metro.register(InvitePermissions);
		await startPlugin();

		expect(selfTest()).toEqual({ ok: true, detail: '2 features applied' });
	});

	test('still starts the other feature when one cannot start', async () => {
		const error = spyOn(console, 'error').mockImplementation(() => {});

		metro.register(BrokenMessageRowData);
		metro.register(InvitePermissions);
		await startPlugin();

		expect(InvitePermissions.useInvitesDisabledPermission()).toBe(true);
		expect(selfTest()).toMatchObject({ ok: false });
		expect(error).toHaveBeenCalled();

		error.mockRestore();
	});
});
