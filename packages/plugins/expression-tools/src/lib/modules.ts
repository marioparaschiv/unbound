import { flux, metro } from '@unbound-app/api';

export const { ActionSheets } = metro.api;
export const { Clipboard } = metro.common;
export const GuildStore = flux.getStore('Guild');
export const UserStore = flux.getStore('User');

// The action bar's buttons and the clone sheet read these on press; each is checked where it is used, so a missing one only disables its button.
export const StickerSheets = metro.findByProps('hideStickerDetailActionSheet');
export const StickerActions = metro.findByProps('favoriteSticker', 'unfavoriteSticker');
export const StickerFavorites = metro.findByProps('isFavoriteSticker');
export const EmojiActions = metro.findByProps('uploadEmoji');
export const Auth = metro.findByProps('getToken');
