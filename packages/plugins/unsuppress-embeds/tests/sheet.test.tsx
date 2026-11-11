import {
	flux,
	metro,
	patches,
	render,
	startPlugin,
	stopPlugin,
	toasts,
} from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { View } from 'react-native';
import { createElement } from 'react';

import { selfTest } from '~/index';

const ME = '1';
const SUPPRESS_FLAG = 4;

type Row = { label: string; variant?: string; onPress: () => void };
type Request = { url: string; body: { flags: number } };

let requests: Request[];
let hidden: string[];
let rejection: unknown;
let deleteLabel: string;
let localised: boolean;

const sheets = {
	openLazy: (_sheet: Promise<unknown>, _key: string, _props: unknown) => {},
	hideActionSheet: (key: string) => void hidden.push(key),
};

function ActionSheetRow(_props: Row) {
	return <View />;
}

function RowGroup({ children }: { hasIcons: boolean; children: unknown }) {
	return <View>{children as never}</View>;
}

function MessageSheet() {
	return (
		<View>
			<RowGroup hasIcons>
				{[
					<ActionSheetRow key='reply' label='Responder' onPress={() => {}} />,
					<ActionSheetRow
						key='report'
						label='Denunciar mensaje'
						variant='danger'
						onPress={() => {}}
					/>,
					<ActionSheetRow
						key='delete'
						label={deleteLabel}
						variant='danger'
						onPress={() => {}}
					/>,
				]}
			</RowGroup>
		</View>
	);
}

function message(overrides: Record<string, unknown> = {}) {
	return { id: '10', channel_id: '20', flags: 0, author: { id: ME }, embeds: [{}], ...overrides };
}

async function openSheet(props: Record<string, unknown> = {}) {
	const module = { default: MessageSheet };

	sheets.openLazy(Promise.resolve(module), 'MessageLongPressActionSheet', {
		message: message(props),
	});
	await Promise.resolve();
	await Promise.resolve();

	return render(createElement(module.default));
}

const labels = (view: ReturnType<typeof render>) =>
	view.findAll('ActionSheetRow').map((node) => node.props.label);

function registerDiscord() {
	metro.register(sheets);

	if (localised) {
		// Discord's localisation module: `intl.string` turns the "Delete Message" message into the user's language.
		metro.register({
			getLanguages: () => [],
			getSystemLocale: () => 'es',
			intl: { string: (message: string) => (message === 'xwMqD7' ? deleteLabel : message) },
			t: { xwMqD7: 'xwMqD7' },
		});
	}

	metro.register({
		getAPIBaseURL: () => '',
		patch: async (request: Request) => {
			if (rejection) throw rejection;

			requests.push(request);
		},
	});
	metro.register({
		Fonts: {},
		Endpoints: {},
		Permissions: { EMBED_LINKS: 1n, MANAGE_MESSAGES: 2n },
	});
	flux.seed({
		Channel: { getChannel: () => ({ id: '20', isPrivate: () => false }) },
		User: { getCurrentUser: () => ({ id: ME }) },
		Permission: { can: () => true },
	});
}

beforeEach(() => {
	deleteLabel = 'Eliminar mensaje';
	localised = true;
	requests = [];
	hidden = [];
	rejection = undefined;
});

describe('starting', () => {
	test('patches the action sheets once Discord has them', async () => {
		registerDiscord();
		await startPlugin();

		expect(patches.applied).toMatchObject([{ method: 'openLazy' }]);
		await stopPlugin();
	});

	test('reports healthy once it has patched the sheets', async () => {
		registerDiscord();
		await startPlugin();

		expect((await selfTest()).ok).toBe(true);
		await stopPlugin();
	});

	test('patches nothing while a Discord module is missing', async () => {
		await startPlugin();

		expect(patches.applied).toEqual([]);
	});
});

describe('a Discord build that renamed its Delete Message message', () => {
	beforeEach(async () => {
		deleteLabel = 'Delete Message';
		localised = false;
		registerDiscord();
		await startPlugin();
	});

	test('still gets Suppress Embeds above the English delete row', async () => {
		expect(labels(await openSheet())).toEqual([
			'Responder',
			'Denunciar mensaje',
			'Suppress Embeds',
			'Delete Message',
		]);
	});
});

describe('the message sheet', () => {
	beforeEach(async () => {
		registerDiscord();
		await startPlugin();
	});

	test('gets Suppress Embeds above the delete row, not above Report Message', async () => {
		expect(labels(await openSheet())).toEqual([
			'Responder',
			'Denunciar mensaje',
			'Suppress Embeds',
			'Eliminar mensaje',
		]);
	});

	test('offers Unsuppress Embeds on a suppressed message', async () => {
		expect(labels(await openSheet({ flags: SUPPRESS_FLAG, embeds: [] }))).toContain(
			'Unsuppress Embeds',
		);
	});

	test('gets no row on a message without embeds', async () => {
		expect(labels(await openSheet({ embeds: [] }))).toEqual([
			'Responder',
			'Denunciar mensaje',
			'Eliminar mensaje',
		]);
	});

	test('gets no row on a sheet that is not for a message', async () => {
		const module = { default: MessageSheet };

		sheets.openLazy(Promise.resolve(module), 'ChannelLongPressActionSheet', {});
		await Promise.resolve();

		expect(labels(render(createElement(module.default)))).toEqual([
			'Responder',
			'Denunciar mensaje',
			'Eliminar mensaje',
		]);
	});

	test('suppresses the embeds when pressed, keeping the other flags', async () => {
		const view = await openSheet({ flags: 1 });

		view.act(() => view.find((node) => node.props.label === 'Suppress Embeds').props.onPress());

		expect(hidden).toEqual(['MessageLongPressActionSheet']);
		await Promise.resolve();
		expect(requests).toEqual([
			{ url: '/channels/20/messages/10', body: { flags: 1 | SUPPRESS_FLAG } },
		]);
	});

	test('shows why Discord refused the change', async () => {
		rejection = { body: { message: 'Missing Permissions' } };
		const view = await openSheet();

		view.act(() => view.find((node) => node.props.label === 'Suppress Embeds').props.onPress());
		await Promise.resolve();
		await Promise.resolve();

		expect(toasts.shown).toMatchObject([
			{ content: 'Suppress Embeds failed: Missing Permissions' },
		]);
	});
});
