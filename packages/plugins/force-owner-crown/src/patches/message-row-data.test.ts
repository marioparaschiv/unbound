import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Row = { message: Record<string, unknown> };

let platform = 'ios';
const guilds = new Map<string, { ownerId: string }>();

const scope = installAddonGlobals({
	manifest: { id: 'astral.force-owner-crown' },
	unbound: {
		assets: {
			getIDByName: (name: string) => (name === 'ic_crown_16px' ? 42 : undefined),
			getByID: () => ({
				httpServerLocation: '/assets/images/native/icons',
				name: 'ic_crown_16px',
			}),
		},
	},
});

const MessageRowData = { generateMessageRowData: (message: Row['message']): Row => ({ message }) };

scope.metro.register(MessageRowData);
scope.metro.register({ getAssetUriForEmbed: (id: number) => `embed://${id}` });
scope.metro.stores.Guilds = { getGuild: (id: string) => guilds.get(id) };

mock.module('@unbound-app/api', () => scope.unbound);

mock.module('react-native', () => ({
	Image: { resolveAssetSource: () => ({ uri: 'resolved://crown' }) },
	Platform: {
		get OS() {
			return platform;
		},
	},
}));

const { patchOwnerCrown } = await import('~/patches/message-row-data');

function row(message: Record<string, unknown>) {
	return MessageRowData.generateMessageRowData({ ...message }).message;
}

beforeEach(() => {
	platform = 'ios';
	guilds.clear();
	guilds.set('g1', { ownerId: 'owner' });
	scope.patcher.unpatchAll();
	patchOwnerCrown();
});

describe('patchOwnerCrown', () => {
	test('patches the message row builder under the plugin id', () => {
		expect(scope.patcher.patches).toEqual([
			{
				kind: 'after',
				target: MessageRowData,
				method: 'generateMessageRowData',
				caller: 'astral.force-owner-crown',
			},
		]);
	});

	test("gives the owner's messages the crown", () => {
		expect(row({ guildId: 'g1', authorId: 'owner' }).roleIcon).toEqual({
			source: 'embed://42',
			name: 'Server Owner',
			size: 18,
			alt: 'Server Owner',
		});
	});

	test('leaves other members alone', () => {
		expect(row({ guildId: 'g1', authorId: 'member' }).roleIcon).toBeUndefined();
	});

	test('keeps a role icon the owner already has', () => {
		const icon = { source: 'role', name: 'Admin', size: 18, alt: 'Admin' };

		expect(row({ guildId: 'g1', authorId: 'owner', roleIcon: icon }).roleIcon).toBe(icon);
	});

	test('skips direct messages and unknown servers', () => {
		expect(row({ authorId: 'owner' }).roleIcon).toBeUndefined();
		expect(row({ guildId: 'g2', authorId: 'owner' }).roleIcon).toBeUndefined();
	});

	test("uses the APK's drawable on Android", () => {
		platform = 'android';
		scope.patcher.unpatchAll();
		patchOwnerCrown();

		const source = row({ guildId: 'g1', authorId: 'owner' }).roleIcon as { source: string };

		expect(source.source).toStartWith('android.resource://');
	});
});
