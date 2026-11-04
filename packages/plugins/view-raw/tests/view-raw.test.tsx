import { flux, metro, render, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

// The testing kit has no fake for Discord's design components, so these stand in for the few the plugin draws.
mock.module('@unbound-app/api/metro/components', () => ({
	Discord: {
		ActionSheet: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
		Text: ({ children }: { children?: ReactNode }) => <Text>{children}</Text>,
		createStyles: () => () => ({ icon: { color: '#fff' } }),
	},
	BottomSheets: {
		ActionSheetRow: ({ label, onPress }: { label: string; onPress: () => void }) => (
			<Pressable onPress={onPress}>
				<Text>{label}</Text>
			</Pressable>
		),
	},
}));

type MenuItem = { label: string; action: () => void };
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

const guild = { id: '1', name: 'Wumpus Club', ownerId: '2' };

beforeAll(() => {
	metro.register(ContextMenus);
	metro.register(ActionSheets);
	metro.register({
		setString: (value: string) => copied.push(value),
		getString: () => '',
		setImage: () => undefined,
		getImage: () => undefined,
	});
});

beforeEach(async () => {
	opened.length = 0;
	copied.length = 0;
	flux.seed({
		Guild: { getGuild: (id: string) => (id === guild.id ? guild : undefined) },
		User: { getUser: () => undefined },
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

		menu.items[0]?.action();
		await settle();

		expect(opened).toHaveLength(1);

		const sheet = render(opened[0]?.Sheet() as ReactNode);

		expect(sheet.text()).toContain('Raw Guild Data');
		expect(sheet.find('TextInput').props.value).toBe(
			JSON.stringify({ id: '1', name: 'Wumpus Club', ownerId: '2' }, null, 4),
		);
	});

	test('copies the data and says so', async () => {
		const menu: Menu = { key: guild.id, items: [] };

		ContextMenus.showContextMenu(menu);
		menu.items[0]?.action();
		await settle();

		const sheet = render(opened[0]?.Sheet() as ReactNode);
		const copy = sheet.findAll('Pressable').find((button) => button.text() === 'Copy data');

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
		const labels = sheet.findAll('Text').map((node) => node.text());

		expect(labels).toEqual(['Reply', 'View Raw', 'Copy Text']);

		const row = sheet.findAll('Pressable').find((node) => node.text() === 'View Raw');

		row?.props.onPress?.(Object.create(null));
		await settle();

		const raw = render(opened[1]?.Sheet() as ReactNode);

		expect(raw.text()).toContain('Raw Message Data');
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
