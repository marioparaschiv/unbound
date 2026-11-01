import { flux, metro } from '@unbound-app/api';

export const SpotifyActions = metro.findByProps('play', 'sync', 'getMetadata', { lazy: true });
export const ActivityButtons = metro.findByProps('PlayOnSpotifyButton', { lazy: true });
export const SpotifyComponents = metro.findByProps('SpotifyPlayButton', { lazy: true });
export const MediaKeyboardActions = metro.find(
	metro.filters.byTypeName('MediaKeyboardBottomSheetActions'),
	{ lazy: true },
);
export const Icons = metro.findByProps('SpotifyNeutralIcon', { lazy: true });
export const MessageActions = metro.findByProps('sendMessage', 'revealMessage', { lazy: true });
export const DraftActions = metro.findByProps('clearDraft', { lazy: true });

export const SpotifyStore = flux.getStore('Spotify', { lazy: true });
export const SpotifyProtocolStore = flux.getStore('SpotifyProtocol', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });
export const DraftStore = flux.getStore('Draft', { lazy: true });
