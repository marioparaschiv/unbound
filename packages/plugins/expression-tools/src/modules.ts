import { flux, metro } from '@unbound-app/api';

export const { ActionSheets } = metro.api;
export const { Clipboard } = metro.common;
export const Guilds = flux.getStore('Guild', { lazy: true });
export const Users = flux.getStore('User', { lazy: true });

export const StickerDetailActionSheet = metro.findByFilePath(
	'modules/stickers/native/StickerDetailActionSheet.tsx',
	{ lazy: true },
);

// Each is checked where it is used, so a missing one only disables its button.
export const StickerSheets = metro.findByProps('hideStickerDetailActionSheet', { lazy: true });
export const StickerActions = metro.findByProps('favoriteSticker', 'unfavoriteSticker', {
	lazy: true,
});
export const StickerFavorites = metro.findByProps('isFavoriteSticker', { lazy: true });
export const EmojiActions = metro.findByProps('uploadEmoji', { lazy: true });
export const Auth = metro.findByProps('getToken', { lazy: true });
