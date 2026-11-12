import { dialogs, flux, metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { storage } from '@unbound-app/api';

import SettingsPanel from '~/settings';
import { getTags } from '~/lib/saved-commands';

const greet = { name: 'greet', message: 'Hi {{user}}', media: [] };
const dope = { name: 'dope', description: 'Says lol', message: 'lol', media: [] };

function rows(view: ReturnType<typeof render>): unknown[] {
	return view.findAll('TableRow').map((row) => row.props.label);
}

// A row's buttons are its `trailing` prop, which the panel's own render does not draw.
function press(view: ReturnType<typeof render>, label: string) {
	const buttons = view.findAll('TableRow').map((row) => render(row.props.trailing));
	const button = buttons
		.flatMap((rendered) => rendered.findAll('Button'))
		.find((node) => node.props.accessibilityLabel === label);

	if (!button) throw new Error(`No button labelled ${label}.`);

	view.act(() => button.props.onPress?.(Object.create(null)));
}

beforeEach(async () => {
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

describe('the settings panel', () => {
	test('lists each saved command with its summary', () => {
		const view = render(<SettingsPanel />);

		expect(rows(view)).toEqual(['/greet', '/dope']);
		expect(view.findAll('TableRow').map((row) => row.props.subLabel)).toEqual([
			'Hi {{user}}',
			'Says lol',
		]);
	});

	test('says so when nothing is saved', () => {
		storage.getBucket().set('tags', []);

		expect(rows(render(<SettingsPanel />))).toEqual(['No custom commands yet.']);
	});

	test('opens the form when a command is edited', () => {
		const view = render(<SettingsPanel />);

		press(view, 'Edit greet');

		expect(rows(view)).toEqual([]);
		expect(view.find((node) => node.props.text === 'Save command')).toBeDefined();
	});
});

describe('deleting a command', () => {
	test('asks first and deletes it once confirmed', () => {
		const view = render(<SettingsPanel />);

		press(view, 'Delete greet');

		expect(dialogs.opened).toHaveLength(1);
		expect(getTags().map((tag) => tag.name)).toEqual(['greet', 'dope']);

		dialogs.opened[0]?.respond(true);

		return Promise.resolve().then(() => {
			expect(getTags().map((tag) => tag.name)).toEqual(['dope']);
		});
	});

	test('keeps the command when the dialog is cancelled', async () => {
		const view = render(<SettingsPanel />);

		press(view, 'Delete greet');
		dialogs.opened[0]?.respond(false);
		await Promise.resolve();

		expect(getTags().map((tag) => tag.name)).toEqual(['greet', 'dope']);
	});
});
