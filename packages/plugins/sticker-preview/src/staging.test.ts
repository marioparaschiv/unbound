import { beforeEach, describe, expect, mock, test } from 'bun:test';

type SentMessage = { channelId: string; content: string; stickerIds: string[] };

const sent: SentMessage[] = [];
const stickerSends: { channelId: string; stickerIds: string[] }[] = [];
const drafts = new Map<string, string>();
let activeInput: FakeInput | undefined;
let sendResult: () => unknown = () => undefined;

type FakeInput = {
	text: string;
	ownSends: number;
	keyboardOpened: boolean;
	handleSend: (...args: unknown[]) => unknown;
	getText: () => string;
	setText: (text: string) => void;
	openSystemKeyboard: () => void;
};

mock.module('~/modules', () => ({
	ChatInputs: { getBestActiveInputForChannelId: () => activeInput },
	DraftStore: { getDraft: (channelId: string) => drafts.get(channelId) ?? '' },
	MessageActions: {
		_sendMessage(
			channelId: string,
			message: { content: string },
			options: { stickerIds: string[] },
		) {
			sent.push({ channelId, content: message.content, stickerIds: options.stickerIds });

			return sendResult();
		},
		sendStickers(channelId: string, stickerIds: string[]) {
			stickerSends.push({ channelId, stickerIds });

			return sendResult();
		},
	},
}));

const { createStaging } = await import('./staging');

function fakeInput(text = ''): FakeInput {
	const input: FakeInput = {
		text,
		ownSends: 0,
		keyboardOpened: false,
		handleSend: () => {
			input.ownSends++;
		},
		getText: () => input.text,
		setText: (next) => {
			input.text = next;
		},
		openSystemKeyboard: () => {
			input.keyboardOpened = true;
		},
	};

	return input;
}

beforeEach(() => {
	sent.length = 0;
	stickerSends.length = 0;
	drafts.clear();
	activeInput = fakeInput();
	sendResult = () => undefined;
	globalThis.__unboundStagedStickers = undefined;
});

describe('createStaging', () => {
	test('stages a sticker once and opens the keyboard', () => {
		const staging = createStaging();

		staging.stage('c1', { id: 7 });
		staging.stage('c1', { id: 7 });

		expect(staging.get('c1')).toEqual([{ id: 7 }]);
		expect(activeInput?.keyboardOpened).toBe(true);
		staging.dispose();
	});

	test('ignores a sticker without an id', () => {
		const staging = createStaging();

		staging.stage('c1', undefined);
		staging.stage('c1', { id: '' });

		expect(staging.get('c1')).toEqual([]);
		staging.dispose();
	});

	test('sends staged stickers alone when the composer is empty', () => {
		const staging = createStaging();

		staging.stage('c1', { id: 1 });
		staging.stage('c1', { id: 2 });
		activeInput?.handleSend();

		expect(stickerSends).toEqual([{ channelId: 'c1', stickerIds: ['1', '2'] }]);
		expect(sent).toEqual([]);
		expect(staging.get('c1')).toEqual([]);
		staging.dispose();
	});

	test('sends the typed text with the stickers and clears the composer', () => {
		const staging = createStaging();

		staging.stage('c1', { id: 3 });
		activeInput!.text = 'look at this';
		activeInput?.handleSend();

		expect(sent).toEqual([{ channelId: 'c1', content: 'look at this', stickerIds: ['3'] }]);
		expect(activeInput?.text).toBe('');
		staging.dispose();
	});

	test('falls back to the saved draft when the input has no text', () => {
		const staging = createStaging();

		drafts.set('c1', 'from the draft');
		staging.stage('c1', { id: 4 });
		activeInput?.handleSend();

		expect(sent[0]?.content).toBe('from the draft');
		staging.dispose();
	});

	test("restores Discord's own send once nothing is staged", () => {
		const staging = createStaging();
		const input = activeInput!;
		const original = input.handleSend;

		staging.stage('c1', { id: 5 });
		expect(input.handleSend).not.toBe(original);

		staging.clear('c1');
		expect(input.handleSend).toBe(original);

		input.handleSend();
		expect(input.ownSends).toBe(1);
		staging.dispose();
	});

	test('keeps the stickers staged when a send fails', async () => {
		const staging = createStaging();

		sendResult = () => Promise.reject(new Error('offline'));
		staging.stage('c1', { id: 6 });

		await expect(Promise.resolve(staging.send('c1'))).rejects.toThrow('offline');
		expect(staging.get('c1')).toEqual([{ id: 6 }]);
		staging.dispose();
	});

	test('ignores a second send while the first is pending', async () => {
		const staging = createStaging();
		let resolve: (value: unknown) => void = () => {};

		sendResult = () => new Promise((done) => (resolve = done));
		staging.stage('c1', { id: 8 });

		const first = staging.send('c1');

		expect(staging.send('c1')).toBeUndefined();
		resolve('ok');
		expect(await first).toBe('ok');
		expect(stickerSends).toHaveLength(1);
		staging.dispose();
	});

	test('dispose clears every channel and unhooks every input', () => {
		const staging = createStaging();
		const input = activeInput!;
		const original = input.handleSend;

		staging.stage('c1', { id: 9 });
		staging.stage('c2', { id: 10 });
		staging.dispose();

		expect(staging.get('c1')).toEqual([]);
		expect(staging.get('c2')).toEqual([]);
		expect(input.handleSend).toBe(original);
	});

	test('keeps the send button on while stickers are staged', async () => {
		const staging = createStaging();
		const states: boolean[] = [];
		const button = { setHasText: (hasText: boolean) => states.push(hasText) };

		staging.trackSendButton('c1', { current: button });
		await new Promise((done) => setTimeout(done, 0));
		staging.stage('c1', { id: 11 });
		button.setHasText(false);

		expect(states.at(-1)).toBe(true);
		staging.dispose();
		button.setHasText(false);
		expect(states.at(-1)).toBe(false);
	});
});
