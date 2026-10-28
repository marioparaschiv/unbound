import { beforeEach, describe, expect, mock, test } from 'bun:test';

type AfterContext = { args: unknown[]; result: { message?: Record<string, unknown> } };
type AfterCallback = (context: AfterContext) => void;

let after: AfterCallback = () => {};
let platform = 'ios';
const guilds = new Map<string, { ownerId: string }>();

mock.module('react-native', () => ({
	Image: { resolveAssetSource: () => ({ uri: 'resolved://crown' }) },
	Platform: {
		get OS() {
			return platform;
		},
	},
}));

mock.module('@unbound-app/api', () => ({
	assets: {
		getIDByName: (name: string) => (name === 'ic_crown_16px' ? 42 : undefined),
		getByID: () => ({
			httpServerLocation: '/assets/images/native/icons',
			name: 'ic_crown_16px',
		}),
	},
}));

mock.module('~/modules', () => ({
	AssetUris: { getAssetUriForEmbed: (id: number) => `embed://${id}` },
	GuildStore: { getGuild: (id: string) => guilds.get(id) },
	MessageRowData: {},
	Patcher: {
		after: (_target: object, _name: string, callback: AfterCallback) => {
			after = callback;

			return () => {};
		},
	},
}));

const { patchOwnerCrown } = await import('./message-row-data');

function row(message: Record<string, unknown>) {
	const result = { message: { ...message } };

	after({ args: [], result });

	return result.message;
}

beforeEach(() => {
	platform = 'ios';
	guilds.clear();
	guilds.set('g1', { ownerId: 'owner' });
	patchOwnerCrown();
});

describe('patchOwnerCrown', () => {
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
		patchOwnerCrown();

		const source = row({ guildId: 'g1', authorId: 'owner' }).roleIcon as { source: string };

		expect(source.source).toStartWith('android.resource://');
	});
});
