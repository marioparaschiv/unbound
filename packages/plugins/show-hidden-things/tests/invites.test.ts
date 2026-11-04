import { settings } from '@unbound-app/settings';
import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

const InvitePermissions = { useInvitesDisabledPermission: () => false };

beforeEach(async () => {
	metro.register(InvitePermissions);
	await startPlugin();
});

describe('the Pause Invites setting', () => {
	test('shows to members who lack the permission', () => {
		expect(InvitePermissions.useInvitesDisabledPermission()).toBe(true);
	});

	test('goes back to Discord’s own answer when the setting is off', () => {
		settings.showInvitesPaused = false;

		expect(InvitePermissions.useInvitesDisabledPermission()).toBe(false);
	});
});
