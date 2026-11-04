import { flux, metro, render, startPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { View } from 'react-native';

type MenuItem = { label?: string; action?: () => void };
type Menu = { items: MenuItem[]; key?: string; guild?: { id: string } };

// The testing kit cannot serve `@unbound-app/api/metro/components` yet, so the pieces the plugin reads are stubbed here.
mock.module('@unbound-app/api/metro/components', () => ({
	Discord: { Text: 'Text' },
	BottomSheets: {},
}));

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

beforeEach(async () => {
	metro.register(ContextMenus);
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
	await startPlugin();
});

describe('the View Permissions item in a context menu', () => {
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
