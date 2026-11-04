import { createFakeReactNative, metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { memo, type ComponentType, type ReactNode } from 'react';

import type { StoreSeeds } from '@unbound-app/api/testing';

class AnimatedValue {
	constructor(public value: number) {}

	setValue(value: number) {
		this.value = value;
	}

	stopAnimation() {}

	interpolate() {
		return this;
	}
}

// The kit's `react-native` has no `Animated`; these finish at once.
const reactNative = createFakeReactNative();

mock.module('react-native', () => ({
	...reactNative,
	Animated: {
		Value: AnimatedValue,
		View: 'View',
		Image: 'Image',
		timing: (value: AnimatedValue, { toValue }: { toValue: number }) => ({
			start: (done?: () => void) => {
				value.setValue(toValue);
				done?.();
			},
		}),
	},
	TextInput: { State: {} },
}));

// The kit has no fakes for `native`, `plugins` or Discord's design components, so stand in for them.
mock.module('~/preview/text-replace', () => ({ applyTextReplace: (content: string) => content }));
mock.module('@unbound-app/api/metro/components', () => ({
	Portal: { Portal: ({ children }: { children: ReactNode }) => children },
}));

const { patchChatInputRightActions } = await import('~/preview/ios/right-actions');

mock.module('~/preview/platform', () => ({ patchPreviewButton: patchChatInputRightActions }));

const ChatInputRightActions = {
	default: memo((_props: { channel: { id: string } }) => <ActionsView />),
};

// Host components by name: a static `react-native` import would load before the mock below.
const ActionsView = 'View' as unknown as ComponentType;
const HostText = 'Text' as unknown as ComponentType<{ children?: ReactNode }>;
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
