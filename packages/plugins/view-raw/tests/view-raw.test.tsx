import { flux, metro, render, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

type MenuItem = { label: string; action?: () => void };
type Menu = { key: string; items: MenuItem[] };
type Opened = { key: string; Sheet: () => ReactNode };

const opened: Opened[] = [];
const copied: string[] = [];

const ContextMenus = {
	showContextMenu: (_menu: Menu) => undefined,
	hideContextMenu: () => undefined,
};

const ActionSheets = {
	openLazy: (sheet: Promise<{ default: () => ReactNode }>, key: string, _props?: object) => {
		void sheet.then((module) => opened.push({ key, Sheet: module.default }));
	},
	hideActionSheet: (_key: string) => undefined,
};

// Discord's localisation module: `intl.string` turns the "View Main Profile" message into the user's language.
let mainProfileLabel = 'View Main Profile';

const i18n = {
	getLanguages: () => [],
	getSystemLocale: () => 'en-US',
	intl: { string: (message: string) => (message === 'GISTta' ? mainProfileLabel : message) },
	t: { GISTta: 'GISTta' },
};

const user = { id: '2', username: 'wumpus' };
const guild = { id: '1', name: 'Wumpus Club', ownerId: '2' };

beforeEach(async () => {
	metro.register(ContextMenus);
	metro.register(ActionSheets);
	metro.register({
		setString: (value: string) => copied.push(value),
		getString: () => '',
		setImage: () => undefined,
		getImage: () => undefined,
	});
	metro.register(i18n);
	mainProfileLabel = 'View Main Profile';
	opened.length = 0;
	copied.length = 0;
	flux.seed({
		Guild: { getGuild: (id: string) => (id === guild.id ? guild : undefined) },
		User: { getUser: (id: string) => (id === user.id ? user : undefined) },
		Channel: { getChannel: () => undefined },
		UserProfile: {},
	});
	await startPlugin();
});

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("a server's context menu", () => {
	test('gets a View Raw item that opens the server data with its keys sorted', async () => {
		const menu: Menu = { key: guild.id, items: [] };

		ContextMenus.showContextMenu(menu);
		expect(menu.items.map((item) => item.label)).toEqual(['View Raw']);

		menu.items[0]?.action?.();
		await settle();

		expect(opened).toHaveLength(1);

		const sheet = render(opened[0]?.Sheet() as ReactNode);

		expect(sheet.find('BottomSheetTitleHeader').props.title).toBe('Raw Guild Data');
		expect(sheet.find('TextInput').props.value).toBe(
			JSON.stringify({ id: '1', name: 'Wumpus Club', ownerId: '2' }, null, 4),
		);
	});

	test('copies the data and says so', async () => {
		const menu: Menu = { key: guild.id, items: [] };

		ContextMenus.showContextMenu(menu);
		menu.items[0]?.action?.();
		await settle();

		const sheet = render(opened[0]?.Sheet() as ReactNode);
		const copy = sheet.findAll('Button').find((button) => button.props.text === 'Copy data');

		copy?.props.onPress?.(Object.create(null));
		await settle();

		expect(copied).toEqual([
			JSON.stringify({ id: '1', name: 'Wumpus Club', ownerId: '2' }, null, 4),
		]);
		expect(toasts.shown).toMatchObject([
			{ title: 'View Raw', content: 'Guild data copied to clipboard.' },
		]);
	});

	test('gets no duplicate item when it is shown twice', () => {
		const menu: Menu = { key: guild.id, items: [] };

		ContextMenus.showContextMenu(menu);
		ContextMenus.showContextMenu(menu);

		expect(menu.items).toHaveLength(1);
	});

	test('stays unchanged for a menu that is not a server', () => {
		const menu: Menu = { key: 'somewhere-else', items: [] };

		ContextMenus.showContextMenu(menu);

		expect(menu.items).toEqual([]);
	});
});

describe("a profile's overflow menu", () => {
	async function openProfile() {
		ActionSheets.openLazy(Promise.resolve({ default: () => null }), 'UserProfileActionSheet', {
			userId: user.id,
			user,
		});
		await settle();
	}

	function overflowMenu(label: string): Menu {
		return { key: 'overflow', items: [{ label, action: () => undefined }] };
	}

	test('gets a View Raw item next to View Main Profile', async () => {
		await openProfile();

		const menu = overflowMenu('View Main Profile');

		ContextMenus.showContextMenu(menu);

		expect(menu.items.map((item) => item.label)).toEqual(['View Main Profile', 'View Raw']);
	});

	test('gets the item whatever language Discord shows the label in', async () => {
		mainProfileLabel = 'Voir le profil principal';
		await openProfile();

		const menu = overflowMenu('Voir le profil principal');

		ContextMenus.showContextMenu(menu);

		expect(menu.items.map((item) => item.label)).toEqual([
			'Voir le profil principal',
			'View Raw',
		]);
	});

	test('stays unchanged for a menu without the main profile item', async () => {
		await openProfile();

		const menu = overflowMenu('Block');

		ContextMenus.showContextMenu(menu);

		expect(menu.items.map((item) => item.label)).toEqual(['Block']);
	});
});

function MessageSheet() {
	return (
		<View>
			<Group hasIcons={false}>
				{[
					<Row key='reply' label='Reply' onPress={() => undefined} />,
					<Row key='copy' label='Copy Text' onPress={() => undefined} />,
				]}
			</Group>
		</View>
	);
}

function Group({ children }: { hasIcons: boolean; children?: ReactNode }) {
	return <View>{children}</View>;
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable onPress={onPress}>
			<Text>{label}</Text>
		</Pressable>
	);
}

describe("a message's action sheet", () => {
	test('gets a View Raw row after the first row, without the author’s private fields', async () => {
		const message = {
			id: '9',
			content: 'hello',
			author: { id: '2', username: 'wumpus', email: 'wumpus@example.com' },
		};

		ActionSheets.openLazy(
			Promise.resolve({ default: MessageSheet }),
			'MessageLongPressActionSheet',
			{
				message,
			},
		);
		await settle();

		const sheet = render(opened[0]?.Sheet() as ReactNode);
		const labels = sheet
			.findAll((node) => node.name === 'Row' || node.name === 'ActionSheetRow')
			.map((node) => node.props.label);

		expect(labels).toEqual(['Reply', 'View Raw', 'Copy Text']);

		sheet.find('ActionSheetRow').props.onPress?.();
		await settle();

		const raw = render(opened[1]?.Sheet() as ReactNode);

		expect(raw.find('BottomSheetTitleHeader').props.title).toBe('Raw Message Data');
		expect(raw.findAll('TextInput').map((input) => input.props.value)).toEqual([
			'hello',
			JSON.stringify(
				{ author: { id: '2', username: 'wumpus' }, content: 'hello', id: '9' },
				null,
				4,
			),
		]);
	});

	test('leaves a sheet it does not support alone', async () => {
		ActionSheets.openLazy(Promise.resolve({ default: MessageSheet }), 'SomethingElseSheet', {
			message: { id: '9' },
		});
		await settle();

		const labels = render(opened[0]?.Sheet() as ReactNode)
			.findAll('Text')
			.map((node) => node.text());

		expect(labels).toEqual(['Reply', 'Copy Text']);
	});
});
