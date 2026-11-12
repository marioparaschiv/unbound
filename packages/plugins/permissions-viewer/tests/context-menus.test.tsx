import { logs, flux, metro, render, startPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';
import { View } from 'react-native';

type MenuItem = { label?: string; action?: () => void };
type Menu = { items: MenuItem[]; key?: string; guild?: { id: string } };

const ContextMenus = {
	showContextMenu: (_menu?: Menu) => {},
	hideContextMenu: () => {},
};
const ActionSheets = {
	openLazy: (_sheet?: Promise<unknown>, _key?: unknown, _props?: unknown) => {},
	hideActionSheet: (_key?: string) => {},
};
const ShieldUserIcon = () => null;

function UserProfileRolesCard(_props: { guildId?: string; userId?: string }) {
	return <View />;
}

// The patch replaces `default` on the module, so a test renders it from there.
const rolesCard = { default: UserProfileRolesCard };

function open(menu: Menu) {
	ContextMenus.showContextMenu(menu);

	return menu.items.map((item) => item.label);
}

// A module Discord changed so that its method cannot be read, which a patch on it throws on.
const BrokenContextMenus = {
	get showContextMenu(): never {
		throw new Error('The menu module changed shape.');
	},
	hideContextMenu: () => {},
};

function registerDiscord({ brokenContextMenus = false } = {}) {
	metro.register(brokenContextMenus ? BrokenContextMenus : ContextMenus);

	metro.register(ActionSheets);
	metro.register({ ShieldUserIcon });
	metro.register(rolesCard, 'modules/user_profile/native/UserProfileRolesCard.tsx');
	metro.register({ Fonts: {}, Endpoints: {}, Permissions: { SEND_MESSAGES: 1n << 11n } });
	metro.register({ getGuildPermissionSpecMap: () => ({}) });
	flux.seed({
		Guild: {
			getGuild: (id: string) =>
				id === 'g' ? { id, name: 'Guild', ownerId: 'o' } : undefined,
		},
		GuildRole: { getSortedRoles: () => [] },
		GuildMember: { getMember: () => ({ userId: 'u' }) },
		Channel: { getChannel: () => undefined },
		User: { getUser: () => undefined },
	});
}

async function launch() {
	registerDiscord();
	await startPlugin();
}

describe('the View Permissions item in a context menu', () => {
	beforeEach(launch);

	test("is added to a server's menu", () => {
		expect(open({ items: [], key: 'g' })).toEqual(['View Permissions']);
	});

	test('is added once, however often the menu opens', () => {
		const menu: Menu = { items: [], key: 'g' };

		open(menu);

		expect(open(menu)).toEqual(['View Permissions']);
	});

	test('is left out of menus that are not about a server the client knows', () => {
		expect(open({ items: [], key: 'elsewhere' })).toEqual([]);
	});
});

describe('the View Permissions button under the roles card', () => {
	beforeEach(launch);

	test('follows the roles of a server profile', () => {
		const view = render(<rolesCard.default guildId='g' userId='u' />);

		expect(view.find('Pressable').props.accessibilityLabel).toBe('View Permissions');
	});

	test('is left out of profiles outside a server', () => {
		expect(render(<rolesCard.default userId='u' />).findAll('Pressable')).toEqual([]);
	});

	test('goes away when the setting is turned off', () => {
		settings.rolesCardButton = false;

		expect(render(<rolesCard.default guildId='g' userId='u' />).findAll('Pressable')).toEqual(
			[],
		);
	});
});

describe('the overflow menu of a server profile', () => {
	beforeEach(async () => {
		await launch();
		ActionSheets.openLazy(Promise.resolve({}), 'UserProfileActionSheet', {
			userId: 'u',
			guildId: 'g',
		});
	});

	test("is recognized by Discord's own wording, whatever the language", () => {
		metro.register({
			getLanguages: () => [],
			getSystemLocale: () => 'de',
			t: { y5MwJy: 'y5MwJy' },
			intl: { formatToPlainString: () => 'Benutzernamen kopieren' },
		});

		expect(open({ items: [{ label: 'Benutzernamen kopieren' }] })).toEqual([
			'Benutzernamen kopieren',
			'View Permissions',
		]);
	});

	test('is recognized by the English wording when Discord has no such message', () => {
		expect(open({ items: [{ label: 'Copy User ID' }] })).toEqual([
			'Copy User ID',
			'View Permissions',
		]);
	});

	test('leaves a menu with other rows alone', () => {
		expect(open({ items: [{ label: 'Something else' }] })).toEqual(['Something else']);
	});
});

describe('the plugin on start', () => {
	test('starts without a warning once its three patches apply', async () => {
		await launch();

		expect(logs.entries.filter(({ level }) => level !== 'info')).toEqual([]);
	});

	test('fails to start when a patch throws, so Unbound removes the rest', async () => {
		registerDiscord({ brokenContextMenus: true });

		const failure = await startPlugin().catch((error: unknown) => error);

		expect(failure).toEqual(new Error('The menu module changed shape.'));
	});

	test('keeps the other patches with one warning when Discord moved the roles card', async () => {
		registerDiscord();
		metro.markMissing('modules/user_profile/native/UserProfileRolesCard.tsx');
		await startPlugin();

		expect(open({ items: [], key: 'g' })).toEqual(['View Permissions']);
		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Roles card button skipped: Discord moved UserProfileRolesCard or Constants.'],
		});
	});
});
