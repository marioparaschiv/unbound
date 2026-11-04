import { flux, metro, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { storage } from '@unbound-app/api';

// The testing kit fakes neither `ui` nor Discord's design components, which only the settings panel draws.
mock.module('~/settings', () => ({ default: () => null }));

// ...and it has no `fs`, which only the attachment files use.
mock.module('~/commands/media', () => ({
	isSaved: (media: object) => 'storedName' in media,
	mediaUri: (media: { storedName: string }) => `file:///documents/${media.storedName}`,
	pickMedia: async () => [],
	persistMedia: async () => {
		throw new Error('The testing kit has no file system.');
	},
	removeStoredMedia: async () => undefined,
}));

type BuiltIn = {
	displayName: string;
	displayDescription: string;
	options: { name: string; required: boolean; displayDescription: string }[];
	execute: (
		options: { name: string; value?: string | boolean }[],
		context: object,
	) => Promise<void>;
};

const sent: { channelId: string; content: string }[] = [];
const botMessages: { channelId: string; content: string }[] = [];

const Commands = {
	getBuiltInCommands: (_types: number[]): BuiltIn[] => [],
};

const Messages = {
	sendMessage: () => undefined,
	receiveMessage: () => undefined,
	sendBotMessage: (channelId: string, message: { content: string }) => {
		botMessages.push({ channelId, content: message.content });
	},
	_sendMessage: async (channelId: string, message: { content: string }) => {
		sent.push({ channelId, content: message.content });

		return { ok: true };
	},
};

const greet = { name: 'greet', message: 'Hi {{user}}, I feel {{mood = great}}.', media: [] };
const photo = {
	name: 'photo',
	message: '',
	media: [
		{
			storedName: 'custom-commands-1-abc.png',
			fileName: 'photo.png',
			fileSize: 12,
			mimeType: 'image/png',
		},
	],
};

function listCommands(): BuiltIn[] {
	return Commands.getBuiltInCommands([1]);
}

function command(name: string): BuiltIn {
	const found = listCommands().find((entry) => entry.displayName === name);

	if (!found) throw new Error(`Command ${name} is not listed.`);

	return found;
}

beforeAll(() => {
	metro.register(Commands);
	metro.register(Messages);
});

beforeEach(async () => {
	sent.length = 0;
	botMessages.length = 0;
	flux.seed({ PendingReply: { getPendingReply: () => undefined } });
	storage.getBucket().set('tags', [greet, photo]);
	await startPlugin();
});

describe('the slash command list', () => {
	test('shows each saved command with its arguments and an ephemeral switch', () => {
		const listed = command('greet');

		expect(listed.displayDescription).toBe('Send the greet command');
		expect(listed.options.map(({ name, required }) => [name, required])).toEqual([
			['user', true],
			['mood', false],
			['ephemeral', false],
		]);
		expect(listed.options.at(-1)?.displayDescription).toBe('Only show the response to you');
	});

	test('stays empty while nothing is saved', () => {
		storage.getBucket().set('tags', []);

		expect(listCommands()).toEqual([]);
	});
});

describe('running a saved command', () => {
	test('sends the response with its arguments filled in', async () => {
		await command('greet').execute([{ name: 'user', value: 'Ada' }], { channel: { id: '5' } });

		expect(sent).toEqual([{ channelId: '5', content: 'Hi Ada, I feel great.' }]);
	});

	test('shows the response only to the user when ephemeral', async () => {
		await command('greet').execute(
			[
				{ name: 'user', value: 'Ada' },
				{ name: 'ephemeral', value: true },
			],
			{ channel: { id: '5' } },
		);

		expect(sent).toEqual([]);
		expect(botMessages).toEqual([{ channelId: '5', content: 'Hi Ada, I feel great.' }]);
	});

	test('refuses to send a command with attachments ephemerally', async () => {
		await command('photo').execute([{ name: 'ephemeral', value: true }], {
			channel: { id: '5' },
		});

		expect(botMessages).toEqual([]);
		expect(toasts.shown).toMatchObject([
			{
				title: 'Custom Commands',
				content: 'Commands with attachments cannot be sent ephemerally.',
			},
		]);
	});
});
