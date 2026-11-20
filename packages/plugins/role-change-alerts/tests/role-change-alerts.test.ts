import { flux, startPlugin, toasts } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

// UNKNOWN: a test sends Discord's action payloads, which FluxAction does not type.
type Action = { type: string } & Record<string, unknown>;

const ME = '1';
let myRoles = ['r1'];

const ROLES: Record<string, string> = { r1: 'Member', r2: 'Moderator' };

beforeEach(async () => {
	myRoles = ['r1'];
	flux.seed({
		User: { getCurrentUser: () => ({ id: ME }) },
		Guild: { getGuild: () => ({ name: 'The Botcave', icon: 'abc' }) },
		GuildMember: { getMember: () => ({ roles: myRoles }) },
		GuildRole: { getRole: (_guild: string, id: string) => ({ name: ROLES[id] }) },
	});
	settings.gained = true;
	settings.lost = true;
	await startPlugin();
});

function dispatch(action: Action) {
	return flux.dispatch(action);
}

const update = (roles: string[], userId = ME) =>
	dispatch({ type: 'GUILD_MEMBER_UPDATE', guildId: 'g1', user: { id: userId }, roles });

describe('role change alerts', () => {
	test('names the role you got and the server', async () => {
		await update(['r1', 'r2']);

		expect(toasts.shown).toMatchObject([
			{
				content: 'You got the Moderator role in The Botcave.',
				icon: { uri: 'https://cdn.discordapp.com/icons/g1/abc.png' },
			},
		]);
	});

	test('names the role you lost', async () => {
		await update([]);

		expect(toasts.shown).toMatchObject([
			{ content: 'You lost the Member role in The Botcave.' },
		]);
	});

	test('stays quiet about other members and turned-off changes', async () => {
		await update(['r1', 'r2'], '2');
		settings.lost = false;
		await update([]);

		expect(toasts.shown).toEqual([]);
	});
});
