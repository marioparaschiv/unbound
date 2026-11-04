import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { flux, metro, render, startPlugin, stopPlugin, toasts } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { createElement, memo } from 'react';
import { Text, View } from 'react-native';

import { selfTest } from '~/index';

const copied: string[] = [];
const favorites = new Set<string>();

const ActionSheets = {
	openLazy: (_load: Promise<unknown>, _key: string) => {},
	hideActionSheet: (_key: string) => {},
};

const Clipboard = {
	setString: async (text: string) => void copied.push(text),
	getString: async () => '',
	setImage: async () => {},
	getImage: async () => '',
};

const StickerActions = {
	favoriteSticker: async (id: string) => void favorites.add(id),
	unfavoriteSticker: async (id: string) => void favorites.delete(id),
};

// A fresh module each time, since the plugin patches a sheet's component once.
function createSheet() {
	return {
		default: (_props: object) => (
			<View>{[<Text key='name'>Sheet</Text>, <Text key='details'>Details</Text>]}</View>
		),
	};
}

// Lets the sheet's lazy load and the button's async work finish.
async function settle() {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

// Opens a sheet the way Discord does, then draws its patched component.
async function openSheet(key: string, module: ReturnType<typeof createSheet>, props: object) {
	ActionSheets.openLazy(Promise.resolve(module), key);
	await settle();

	return render(createElement(module.default, props));
}

function press(view: ReturnType<typeof render>, label: string) {
	const button = view.findAll('Pressable').find((node) => node.text() === label);

	if (!button) throw new Error(`No ${label} button`);

	view.act(() => button.props.onPress?.(Object.create(null)));
}

function GuildStickerDetail(_props: object) {
	return <View>{[<Text key='name'>wave</Text>]}</View>;
}

// Discord opens the sticker sheet from a message without `openLazy`, as a memo that renders the detail.
const stickerSheet = {
	default: memo(function StickerDetailActionSheet(props: { sticker: object }) {
		return <GuildStickerDetail {...props} />;
	}),
};

const emoji = { emoji: { id: '123', name: 'moai', animated: true } };

beforeEach(async () => {
	copied.length = 0;
	favorites.clear();
	metro.register(ActionSheets);
	metro.register(Clipboard);
	metro.register(StickerActions);
	metro.register({ isFavoriteSticker: (id: string) => favorites.has(id) });
	metro.register({ hideStickerDetailActionSheet: () => {} });
	metro.register({ uploadEmoji: async () => {} });
	metro.register({ getToken: () => 'token' });
	metro.register(stickerSheet, 'modules/stickers/native/StickerDetailActionSheet.tsx');
	flux.seed({
		Guild: { getGuilds: () => ({}) },
		User: { getCurrentUser: () => ({ id: '1' }) },
	});
	await startPlugin();
});

describe('the emoji sheet', () => {
	test('offers Copy URL, Copy markup and Clone', async () => {
		const view = await openSheet('EmojiDetailActionSheet', createSheet(), emoji);

		expect(view.findAll('Pressable').map((node) => node.text())).toEqual([
			'Copy URL',
			'Copy markup',
			'Clone',
		]);
	});

	test('copies the markup and confirms with a toast', async () => {
		const view = await openSheet('EmojiDetailActionSheet', createSheet(), emoji);

		press(view, 'Copy markup');
		await settle();

		expect(copied).toEqual(['<a:moai:123>']);
		expect(toasts.shown).toMatchObject([
			{ title: 'Expression Tools', content: 'Emoji markup copied to the clipboard.' },
		]);
	});

	test('copies the image link at 160 pixels', async () => {
		const view = await openSheet('EmojiDetailActionSheet', createSheet(), emoji);

		press(view, 'Copy URL');
		await settle();

		expect(copied).toEqual([
			'https://cdn.discordapp.com/emojis/123.gif?size=160&quality=lossless',
		]);
	});
});

describe('the sticker sheet', () => {
	const sticker = { sticker: { id: '9', format_type: 1, name: 'wave' } };

	test('favorites a sticker, then offers to unfavorite it', async () => {
		const view = await openSheet('StickerDetailActionSheet', createSheet(), sticker);

		press(view, 'Favorite');
		await settle();

		expect(toasts.shown).toMatchObject([{ content: 'wave added to favorites.' }]);
		expect(view.findAll('Pressable').map((node) => node.text())).toContain('Unfavorite');
	});

	test('adds the buttons to the sheet a message opens, which skips openLazy', () => {
		const view = render(createElement(stickerSheet.default, sticker));

		expect(view.findAll('Pressable').map((node) => node.text())).toContain('Favorite');
	});
});

describe('starting', () => {
	async function restart() {
		await stopPlugin();
		resetHealth();
		await startPlugin();
	}

	test('reports both patches applied to the self test', async () => {
		await restart();

		expect(selfTest()).toEqual({ ok: true, detail: '2 features applied' });
	});

	test('keeps the emoji sheet buttons when the sticker sheet cannot be patched', async () => {
		const errors = spyOn(console, 'error').mockImplementation(() => {});

		const sheet = stickerSheet.default;

		stickerSheet.default = 'not a component' as never;
		await restart();
		errors.mockRestore();
		stickerSheet.default = sheet;

		const view = await openSheet('EmojiDetailActionSheet', createSheet(), emoji);

		expect(view.findAll('Pressable')).toHaveLength(3);
		expect(selfTest()).toMatchObject({ ok: false });
	});

	test('draws the buttons again after the plugin stops and starts', async () => {
		await restart();

		const view = await openSheet('EmojiDetailActionSheet', createSheet(), emoji);

		expect(view.findAll('Pressable')).toHaveLength(3);
	});
});
