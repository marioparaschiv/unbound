import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { metro, patcher, storage } from '@unbound-app/api';
import * as api from '@unbound-app/api';

export type Sticker = { id: string };

type PluginEntity = {
	started: boolean;
};

type PluginManager = {
	getEntity: (id: string) => PluginEntity | undefined;
};

// The plugin manager is internal to Unbound, so the API typings leave it out.
type UnboundRuntime = typeof api & {
	plugins: PluginManager;
};

export const DraftStore = metro.findByProps('getDraft', { lazy: true });
export const StickerPreviewStore = metro.findByProps('getStickerPreview', { lazy: true });
export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });
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

export const { FluxHooks } = metro.common;
export const { Users } = metro.stores;

export const Plugins = (api as UnboundRuntime).plugins;

export const textReplaceSettings = storage.getStore('unbound.text-replace');

export const Patcher = patcher.createPatcher('unbound.preview-message');
export const PreviewRunning = createRunningFlag('unbound.preview-message');
