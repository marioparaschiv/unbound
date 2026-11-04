export type SentMessage = { channelId: string; content: string; stickerIds: string[] };

export type FakeInput = {
	text: string;
	ownSends: number;
	keyboardOpened: boolean;
	handleSend: (...args: unknown[]) => unknown;
	getText: () => string;
	setText: (text: string) => void;
	openSystemKeyboard: () => void;
};

export const sent: SentMessage[] = [];
export const stickerSends: { channelId: string; stickerIds: string[] }[] = [];
export const drafts = new Map<string, string>();

// Metro caches each lookup for the whole run, so every test file shares these two modules and changes what they do here.
export const behaviour: { activeInput?: FakeInput; sendResult: () => unknown } = {
	sendResult: () => undefined,
};

export const ChatInputs = {
	getBestActiveInputForChannelId: () => behaviour.activeInput,
};

export const Messages = {
	sendMessage: () => undefined,
	receiveMessage: () => undefined,
	_sendMessage(
		channelId: string,
		message: { content: string },
		options: { stickerIds: string[] },
	) {
		sent.push({ channelId, content: message.content, stickerIds: options.stickerIds });

		return behaviour.sendResult();
	},
	sendStickers(channelId: string, stickerIds: string[]) {
		stickerSends.push({ channelId, stickerIds });

		return behaviour.sendResult();
	},
};

export function fakeInput(text = ''): FakeInput {
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
