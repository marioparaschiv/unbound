import { flux, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Pressable, View } from 'react-native';

import { selfTest } from '~/index';

import { createFakes } from './helpers/fakes';
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

const PATHS = {
	picker: 'modules/stickers/native/StickerPickerListRow.tsx',
	sticker: 'modules/stickers/native/Sticker.tsx',
	container: 'modules/chat_input/native/FloatingChatInputContainer.tsx',
	sendButton: 'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
};

async function start() {
	const fakes = createFakes();

	({ drafts, stickerSends } = fakes);
	flux.seed({
		Draft: { getDraft: (channelId: string) => drafts.get(channelId) ?? '' },
		SelectedChannel: { getChannelId: () => 'c1', getCurrentlySelectedChannelId: () => 'c1' },
		Channel: { getChannel: () => ({ id: 'c1' }) },
	});
	metro.register(fakes.ChatInputs);
	metro.register(fakes.Messages);

	for (const key of Object.keys(PATHS) as (keyof typeof PATHS)[]) {
		metro.register(modules[key], PATHS[key]);
	}

	await startPlugin();
}

beforeEach(start);

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

		render(<Picker onPressSticker={() => undefined} />)
			.find('Pressable')
			.props.onPress?.(undefined as never);

		// Preview Message reads this shared store, so a sticker left in it would show after the plugin stopped.
		expect(globalThis.__unboundStagedStickers?.channels()).toEqual(['c1']);

		await stopPlugin();

		expect(globalThis.__unboundStagedStickers?.channels()).toEqual([]);
	});

	test('is still gone after the plugin stops and starts again', async () => {
		const Picker = modules.picker.default;

		render(<Picker onPressSticker={() => undefined} />)
			.find('Pressable')
			.props.onPress?.(undefined as never);
		await stopPlugin();
		await startPlugin();

		expect(globalThis.__unboundStagedStickers?.channels()).toEqual([]);
	});

	test('is reported as applied by the self test', () => {
		expect(selfTest()).toMatchObject({ ok: true });
	});
});
