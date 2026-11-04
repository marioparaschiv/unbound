import { flux, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Pressable, View } from 'react-native';

import { createFakes } from './fakes';
import type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';

type PickerRowProps = { onPressSticker: (sticker: Sticker) => void };
type SendButtonProps = { channel: { id: string }; onSendMessage?: () => void };

const wumpus: Sticker = { id: '1', opaque: true };

const modules = {
	picker: {
		default: ({ onPressSticker }: PickerRowProps) => (
			<Pressable accessibilityLabel='pick' onPress={() => onPressSticker(wumpus)} />
		),
	},
	sticker: { default: () => <View accessibilityLabel='sticker' /> },
	container: { default: (_props: { channel: { id: string } }) => <View /> },
	sendButton: {
		default: ({ onSendMessage }: SendButtonProps) => (
			<Pressable accessibilityLabel='send' onPress={() => onSendMessage?.()} />
		),
	},
};

let { drafts, stickerSends } = createFakes();

beforeEach(async () => {
	const fakes = createFakes();

	({ drafts, stickerSends } = fakes);
	flux.seed({
		Draft: { getDraft: (channelId: string) => drafts.get(channelId) ?? '' },
		SelectedChannel: { getChannelId: () => 'c1', getCurrentlySelectedChannelId: () => 'c1' },
		Channel: { getChannel: () => ({ id: 'c1' }) },
	});
	metro.register(fakes.ChatInputs);
	metro.register(fakes.Messages);
	metro.register(modules.picker, 'modules/stickers/native/StickerPickerListRow.tsx');
	metro.register(modules.sticker, 'modules/stickers/native/Sticker.tsx');
	metro.register(modules.container, 'modules/chat_input/native/FloatingChatInputContainer.tsx');
	metro.register(
		modules.sendButton,
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	);
	await startPlugin();
});

describe('a picked sticker', () => {
	test('waits above the composer instead of being sent, and can be removed', () => {
		const Picker = modules.picker.default;
		const Container = modules.container.default;

		render(<Picker onPressSticker={() => undefined} />)
			.find('Pressable')
			.props.onPress?.(undefined as never);

		const composer = render(<Container channel={{ id: 'c1' }} />);

		expect(stickerSends).toEqual([]);
		expect(
			composer.findAll('View').some((node) => node.props.accessibilityLabel === 'sticker'),
		).toBe(true);

		composer.find('Pressable').props.onPress?.(undefined as never);
		expect(
			composer.findAll('View').some((node) => node.props.accessibilityLabel === 'sticker'),
		).toBe(false);
	});

	test('is sent alone by the send button', () => {
		const Picker = modules.picker.default;
		const Send = modules.sendButton.default;

		render(<Picker onPressSticker={() => undefined} />)
			.find('Pressable')
			.props.onPress?.(undefined as never);
		render(<Send channel={{ id: 'c1' }} />)
			.find('Pressable')
			.props.onPress?.(undefined as never);

		expect(stickerSends).toEqual([{ channelId: 'c1', stickerIds: ['1'] }]);
	});

	test('is dropped when the plugin stops', async () => {
		const Picker = modules.picker.default;
		const Container = modules.container.default;

		render(<Picker onPressSticker={() => undefined} />)
			.find('Pressable')
			.props.onPress?.(undefined as never);
		await stopPlugin();

		expect(render(<Container channel={{ id: 'c1' }} />).findAll('Pressable')).toEqual([]);
	});
});
