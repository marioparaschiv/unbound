import { dialogs, flux, metro, render, startPlugin } from '@unbound-app/api/testing';
import { Discord } from '@unbound-app/api/metro/components';
import { beforeEach, describe, expect, test } from 'bun:test';
import { storage } from '@unbound-app/api';
import type { ReactNode } from 'react';

import SettingsPanel from '~/settings';
import { getTags } from '~/lib/saved-commands';

type Pushed = { route: string; title: string; render: () => ReactNode };

const greet = { name: 'greet', message: 'Hi {{user}}', media: [] };
const dope = { name: 'dope', description: 'Says lol', message: 'lol', media: [] };

let pushed: Pushed[] = [];
let wentBack = 0;

function rows(view: ReturnType<typeof render>): unknown[] {
	return view.findAll('TableRow').map((row) => row.props.label);
}

function pressRow(view: ReturnType<typeof render>, label: string) {
	const row = view.findAll('TableRow').find((node) => node.props.label === label);

	if (!row) throw new Error(`No row labelled ${label}.`);

	view.act(() => row.props.onPress?.());
}

function pressButton(view: ReturnType<typeof render>, text: string) {
	const button = view.find((node) => node.props.text === text);

	if (!button) throw new Error(`No button reading ${text}.`);

	view.act(() => button.props.onPress?.(Object.create(null)));
}

beforeEach(async () => {
	pushed = [];
	wentBack = 0;
	Object.assign(Discord, {
		useNavigation: () => ({
			push: (route: string, params: Omit<Pushed, 'route'>) =>
				pushed.push({ route, ...params }),
			goBack: () => wentBack++,
		}),
	});
	metro.register({ getBuiltInCommands: () => [] });
	metro.register({
		sendMessage: () => undefined,
		receiveMessage: () => undefined,
		_sendMessage: async () => ({ ok: true }),
	});
	flux.seed({ PendingReply: { getPendingReply: () => undefined } });
	storage.getBucket().set('tags', [greet, dope]);
	await startPlugin();
});

describe('the command list', () => {
	test('lists each saved command with its summary, then a create row', () => {
		const view = render(<SettingsPanel />);

		expect(rows(view)).toEqual(['/greet', '/dope', 'Create command']);
		expect(view.findAll('TableRow').map((row) => row.props.subLabel)).toEqual([
			'Hi {{user}}',
			'Says lol',
			undefined,
		]);
	});

	test('opens a command on its own sub-page', () => {
		const view = render(<SettingsPanel />);

		pressRow(view, '/greet');

		expect(pushed.map(({ route, title }) => [route, title])).toEqual([
			['UNBOUND_CUSTOM', '/greet'],
		]);

		const page = render(pushed[0]?.render());

		expect(rows(page)).toEqual([]);
		expect(page.find((node) => node.props.value === 'greet')).toBeDefined();
		expect(page.find((node) => node.props.text === 'Save command')).toBeDefined();
	});

	test('opens an empty sub-page to create a command', () => {
		const view = render(<SettingsPanel />);

		pressRow(view, 'Create command');

		expect(pushed[0]?.title).toBe('Create command');

		const page = render(pushed[0]?.render());

		expect(page.find((node) => node.props.text === 'Create command')).toBeDefined();
		expect(page.findAll((node) => node.props.text === 'Delete command')).toEqual([]);
	});
});

describe('the command prop', () => {
	test('draws only that command', () => {
		const view = render(<SettingsPanel command='dope' />);

		expect(rows(view)).toEqual([]);
		expect(view.find((node) => node.props.value === 'Says lol')).toBeDefined();
	});

	test('says so when the command does not exist', () => {
		const view = render(<SettingsPanel command='missing' />);

		expect(view.text()).toContain('This command no longer exists.');
	});
});

describe('deleting a command', () => {
	test('asks first, then deletes it and goes back', async () => {
		const view = render(<SettingsPanel command='greet' />);

		pressButton(view, 'Delete command');

		expect(dialogs.opened).toHaveLength(1);
		expect(getTags().map((tag) => tag.name)).toEqual(['greet', 'dope']);

		dialogs.opened[0]?.respond(true);
		await Promise.resolve();

		expect(getTags().map((tag) => tag.name)).toEqual(['dope']);
		expect(wentBack).toBe(1);
	});

	test('keeps the command when the dialog is cancelled', async () => {
		const view = render(<SettingsPanel command='greet' />);

		pressButton(view, 'Delete command');
		dialogs.opened[0]?.respond(false);
		await Promise.resolve();

		expect(getTags().map((tag) => tag.name)).toEqual(['greet', 'dope']);
		expect(wentBack).toBe(0);
	});
});
