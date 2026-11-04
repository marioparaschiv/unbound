import { beforeEach, describe, expect, test } from 'bun:test';
import { flux, metro, render, startPlugin, toasts } from '@unbound-app/api/testing';
import { createElement } from 'react';
import { Text, View } from 'react-native';

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

// Opens a sheet the way Discord does, then draws its patched component.
async function openSheet(key: string, module: ReturnType<typeof createSheet>, props: object) {
	ActionSheets.openLazy(Promise.resolve(module), key);
	await Bun.sleep(0);

	return render(createElement(module.default, props));
}

function press(view: ReturnType<typeof render>, label: string) {
	const button = view.findAll('Pressable').find((node) => node.text() === label);

	if (!button) throw new Error(`No ${label} button`);

	view.act(() => button.props.onPress?.(Object.create(null)));
}

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
	metro.register({ default: () => null }, 'modules/stickers/native/StickerDetailActionSheet.tsx');
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
		await Bun.sleep(0);

		expect(copied).toEqual(['<a:moai:123>']);
		expect(toasts.shown).toMatchObject([
			{ title: 'Expression Tools', content: 'Emoji markup copied to the clipboard.' },
		]);
	});

	test('copies the image link at 160 pixels', async () => {
		const view = await openSheet('EmojiDetailActionSheet', createSheet(), emoji);

		press(view, 'Copy URL');
		await Bun.sleep(0);

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
		await Bun.sleep(0);

		expect(toasts.shown).toMatchObject([{ content: 'wave added to favorites.' }]);
		expect(view.findAll('Pressable').map((node) => node.text())).toContain('Unfavorite');
	});
});
