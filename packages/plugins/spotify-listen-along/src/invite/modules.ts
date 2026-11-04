import { flux, metro } from '@unbound-app/api';

export const MediaKeyboardActions = metro.find(
	metro.filters.byTypeName('MediaKeyboardBottomSheetActions'),
);
export const Icons = metro.findByProps('SpotifyNeutralIcon');
export const MessageActions = metro.api.Messages;
export const DraftActions = metro.findByProps('clearDraft');

export const SpotifyStore = flux.getStore('Spotify');
export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const DraftStore = flux.getStore('Draft');
