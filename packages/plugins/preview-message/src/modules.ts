import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { metro, storage, flux } from '@unbound-app/api';

export type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';

export const DraftStore = flux.getStore('Draft', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });
export const ChatInputs = metro.findByProps('getBestActiveInputForChannelId', { lazy: true });
export const Haptics = metro.findByFilePath('modules/haptics/HapticUtils.native.tsx', {
	lazy: true,
});

// Whole modules, read through `.default` at use: a lazy handle can be neither rendered nor constructed.
export const ChatItem = metro.findByFilePath('components_native/chat/ChatItem.tsx', {
	lazy: true,
});
export const MessageRecord = metro.findByName('MessageRecord', { interop: false, lazy: true });
export const RowManager = metro.findByName('RowManager', { interop: false, lazy: true });

export const Users = flux.getStore('User', { lazy: true });

export const textReplaceSettings = storage.getBucket('astral.text-replace');

export const PreviewRunning = createRunningFlag(addon.id);
