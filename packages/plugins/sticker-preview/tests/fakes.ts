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

/** Fresh Discord fakes for one test; the kit clears registered modules between tests. */
export function createFakes() {
	const sent: SentMessage[] = [];
	const stickerSends: { channelId: string; stickerIds: string[] }[] = [];
	const drafts = new Map<string, string>();

	const behaviour: { activeInput?: FakeInput; sendResult: () => unknown } = {
		sendResult: () => undefined,
	};

	const ChatInputs = {
		getBestActiveInputForChannelId: () => behaviour.activeInput,
	};

	const Messages = {
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

	return { sent, stickerSends, drafts, behaviour, ChatInputs, Messages };
}

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
