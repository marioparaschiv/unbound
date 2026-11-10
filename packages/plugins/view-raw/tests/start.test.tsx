import { flux, metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

type Opened = { key: string; Sheet: () => ReactNode };
type MenuItem = { label: string; action?: () => void };

const opened: Opened[] = [];

const ActionSheets = {
	openLazy: (sheet: Promise<{ default: () => ReactNode }>, key: string, _props?: object) => {
		void sheet.then((module) => opened.push({ key, Sheet: module.default }));
	},
	hideActionSheet: (_key: string) => undefined,
};

const ContextMenus = {
	showContextMenu: (_menu: { key: string; items: MenuItem[] }) => undefined,
	hideContextMenu: () => undefined,
};

const user = { id: '2', username: 'wumpus' };

function Group({ children }: { hasIcons: boolean; children?: ReactNode }) {
	return <View>{children}</View>;
}

function Row({ label }: { label: string; onPress?: () => void }) {
	return (
		<Pressable>
			<Text>{label}</Text>
		</Pressable>
	);
}

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

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

async function renderedLabels(): Promise<unknown[]> {
	ActionSheets.openLazy(
		Promise.resolve({ default: MessageSheet }),
		'MessageLongPressActionSheet',
		{
			message: { id: '9', content: 'hello', author: user },
		},
	);
	await settle();

	return render(opened[0]?.Sheet() as ReactNode)
		.findAll((node) => node.name === 'Row' || node.name === 'ActionSheetRow')
		.map((node) => node.props.label);
}

beforeEach(() => {
	opened.length = 0;
	metro.register(ActionSheets);
	metro.register({ setString: () => undefined, getString: () => '', setImage: () => undefined });
	flux.seed({
		Guild: { getGuild: () => undefined },
		User: { getUser: (id: string) => (id === user.id ? user : undefined) },
		Channel: { getChannel: () => undefined },
		UserProfile: {},
	});
});

async function selfTest() {
	const plugin = await import('~/index');

	return plugin.selfTest();
}

describe('starting without Discord’s context menu module', () => {
	test('still adds the View Raw row to action sheets', async () => {
		await startPlugin();

		expect(await renderedLabels()).toEqual(['Reply', 'View Raw', 'Copy Text']);
	});

	test('reports the missing module in the self test', async () => {
		await startPlugin();

		expect(await selfTest()).toMatchObject({ ok: false });
	});
});

describe('the self test', () => {
	test('reports ok once both features are applied', async () => {
		metro.register(ContextMenus);
		await startPlugin();

		expect(await selfTest()).toEqual({ ok: true, detail: '2 features applied' });
	});
});

describe('a profile overflow menu when Discord has no message for the label', () => {
	test('is matched by the English label', async () => {
		metro.register(ContextMenus);
		metro.register({
			getLanguages: () => [],
			getSystemLocale: () => 'en-US',
			intl: { string: String },
			t: {},
		});
		await startPlugin();
		ActionSheets.openLazy(Promise.resolve({ default: () => null }), 'UserProfileActionSheet', {
			userId: user.id,
			user,
		});
		await settle();

		const menu = { key: 'overflow', items: [{ label: 'View Main Profile' }] as MenuItem[] };

		ContextMenus.showContextMenu(menu);

		expect(menu.items.map((item) => item.label)).toEqual(['View Main Profile', 'View Raw']);
	});
});
