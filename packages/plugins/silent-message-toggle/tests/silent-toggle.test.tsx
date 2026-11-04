import { flux, metro, render, startPlugin, toasts } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { View } from 'react-native';

import type { ReactNode } from 'react';

let platform: 'ios' | 'android' = 'ios';
let channelId = 'a';

// The testing kit has no `native` namespace yet, so the platform picker is stubbed here.
mock.module('@unbound-app/api/native', () => ({
	definePlatform:
		(handlers: Record<string, (...args: never[]) => unknown>) =>
		(...args: never[]) =>
			handlers[platform](...args),
}));

const sent: unknown[][] = [];
const Messages = {
	sendMessage: () => {},
	receiveMessage: () => {},
	_sendMessage: (...args: unknown[]) => void sent.push(args),
};

function RightActions({ children }: { channel: { id: string }; children?: ReactNode }) {
	return <View>{children}</View>;
}

function SendButton(_props: { channel: { id: string } }) {
	return <View />;
}

// The patch replaces `default` on the module, so a test renders it from there.
const rightActions = { default: RightActions };
const sendButton = { default: SendButton };

function register() {
	metro.register(Messages);
	metro.register(
		rightActions,
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
	);
	metro.register(sendButton, 'modules/chat_input/native/accessories/ChatInputSendButton.tsx');
	metro.register({ colors: {}, internal: {} });
	flux.seed({ SelectedChannel: { getChannelId: () => channelId } });
}

function pressToggle(view: ReturnType<typeof render>) {
	view.act(() => view.find('Pressable').props.onPress?.(Object.create(null)));
}

function send(text: string, channel = 'a') {
	Messages._sendMessage(channel, { content: text }, undefined);

	return sent.at(-1);
}

beforeEach(() => {
	platform = 'ios';
	channelId = 'a';
	sent.length = 0;
});

describe('the silent toggle on iOS', () => {
	beforeEach(async () => {
		register();
		await startPlugin();
	});

	test('sits beside the right-hand actions and labels itself by state', () => {
		const view = render(<rightActions.default channel={{ id: 'a' }} />);

		expect(view.find('Pressable').props.accessibilityLabel).toBe('Enable Silent Message');

		pressToggle(view);

		expect(view.find('Pressable').props.accessibilityLabel).toBe('Disable Silent Message');
		expect(toasts.shown).toMatchObject([
			{
				title: 'Silent Message Toggle',
				content: 'Your messages here are sent without notifications.',
			},
		]);
	});

	test('sends the next message silently, then turns itself off', () => {
		pressToggle(render(<rightActions.default channel={{ id: 'a' }} />));

		expect(send('hi')?.[2]).toEqual({ flags: 4096 });
		expect(send('again')?.[2]).toBeUndefined();
	});

	test('keeps the toggle on with Auto Disable off', () => {
		settings.autoDisable = false;
		pressToggle(render(<rightActions.default channel={{ id: 'a' }} />));

		expect(send('one')?.[2]).toEqual({ flags: 4096 });
		expect(send('two')?.[2]).toEqual({ flags: 4096 });
	});

	test('turns off when another channel opens, unless Persist State is on', () => {
		pressToggle(render(<rightActions.default channel={{ id: 'a' }} />));
		channelId = 'b';
		flux.emit('SelectedChannel');

		expect(send('hi')?.[2]).toBeUndefined();

		settings.persistState = true;
		pressToggle(render(<rightActions.default channel={{ id: 'b' }} />));
		channelId = 'c';
		flux.emit('SelectedChannel');

		expect(send('hi', 'c')?.[2]).toEqual({ flags: 4096 });
	});
});

describe('the silent toggle on Android', () => {
	test('sits in front of the send button', async () => {
		platform = 'android';
		register();
		await startPlugin();

		const view = render(<sendButton.default channel={{ id: 'a' }} />);

		expect(view.find('Pressable').props.accessibilityLabel).toBe('Enable Silent Message');
	});
});
