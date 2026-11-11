import { logs, metro, plugins, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, jest, test } from 'bun:test';
import { storage } from '@unbound-app/api';
import { memo } from 'react';
import { Text, View } from 'react-native';

import type { StoreSeeds } from '@unbound-app/api/testing';

import { Timing } from '~/lib/constants';

const ChatInputRightActions = {
	default: memo((_props: { channel: { id: string } }) => <View />),
};

const Message = ({ content }: { content: string }) => <Text>{content}</Text>;

function stores(draft: string): StoreSeeds {
	return {
		Draft: { getDraft: () => draft },
		SelectedChannel: { getChannelId: () => '1' },
		User: { getCurrentUser: () => ({ id: '1', username: 'wumpus' }) },
	};
}

function renderActions(draft: string) {
	return render(<ChatInputRightActions.default channel={{ id: '1' }} />, {
		stores: stores(draft),
	});
}

beforeEach(async () => {
	metro.register(
		ChatInputRightActions,
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
	);
	metro.register(
		{ default: ({ message }: { message: { content: string } }) => <Message {...message} /> },
		'components_native/chat/ChatItem.tsx',
	);
	metro.register({
		name: 'MessageRecord',
		default: class MessageRecord {
			content: string;

			constructor(message: { content: string }) {
				this.content = message.content;
			}
		},
	});
	metro.register({
		name: 'RowManager',
		default: class RowManager {
			generate() {}
		},
	});
	await startPlugin();
});

describe('the chat input', () => {
	test('starts without a warning, so the self test passes', () => {
		expect(logs.entries.filter((entry) => entry.level === 'warn')).toEqual([]);
	});

	test('offers to preview a draft', () => {
		const button = renderActions('hello').find('Pressable');

		expect(button.props.accessibilityLabel).toBe('Preview message');
	});

	test('previews the draft as a message once the button is pressed', async () => {
		jest.useFakeTimers();

		const view = renderActions('hello **there**');

		await view.act(async () => {
			view.find('Pressable').props.onPress?.(Object.create(null));
			jest.advanceTimersByTime(Timing.keyboardDismissFallback);
		});

		jest.useRealTimers();

		expect(view.text()).toContain('Message Preview');
		expect(view.text()).toContain('hello **there**');
	});

	test('applies the Text Replace rules while that plugin runs', async () => {
		storage
			.getBucket('unbound.text-replace')
			.set('stringRules', [{ find: 'hello', replace: 'howdy' }]);
		plugins.set('unbound.text-replace', { started: true });

		jest.useFakeTimers();

		const view = renderActions('hello there');

		await view.act(async () => {
			view.find('Pressable').props.onPress?.(Object.create(null));
			jest.advanceTimersByTime(Timing.keyboardDismissFallback);
		});

		jest.useRealTimers();

		expect(view.text()).toContain('howdy there');
	});

	test('leaves the draft as typed while Text Replace is not running', async () => {
		storage
			.getBucket('unbound.text-replace')
			.set('stringRules', [{ find: 'hello', replace: 'howdy' }]);

		jest.useFakeTimers();

		const view = renderActions('hello there');

		await view.act(async () => {
			view.find('Pressable').props.onPress?.(Object.create(null));
			jest.advanceTimersByTime(Timing.keyboardDismissFallback);
		});

		jest.useRealTimers();

		expect(view.text()).toContain('hello there');
	});
});
