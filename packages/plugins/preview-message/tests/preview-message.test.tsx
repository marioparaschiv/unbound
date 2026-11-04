import { metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { memo, type ComponentType } from 'react';

import type { StoreSeeds } from '@unbound-app/api/testing';

// The kit has no fake for `plugins`, which `applyTextReplace` reads to see whether Text Replace runs.
mock.module('~/preview/text-replace', () => ({ applyTextReplace: (content: string) => content }));

const ChatInputRightActions = {
	default: memo((_props: { channel: { id: string } }) => <ActionsView />),
};

// Host components by name.
const ActionsView = 'View' as unknown as ComponentType;
const HostText = 'Text' as unknown as ComponentType<{ children?: string }>;
const Message = ({ content }: { content: string }) => <HostText>{content}</HostText>;

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
	test('offers to preview a draft', () => {
		const button = renderActions('hello').find('Pressable');

		expect(button.props.accessibilityLabel).toBe('Preview message');
	});

	test('previews the draft as a message once the button is pressed', async () => {
		const view = renderActions('hello **there**');

		await view.act(async () => {
			view.find('Pressable').props.onPress?.(Object.create(null));
			await new Promise((resolve) => setTimeout(resolve, 400));
		});

		expect(view.text()).toContain('Message Preview');
		expect(view.text()).toContain('hello **there**');
	});
});
