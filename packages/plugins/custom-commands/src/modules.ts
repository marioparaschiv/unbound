import { metro, patcher, storage } from '@unbound-app/api';

export const { Commands, Dispatcher } = metro.common;
export const { Messages } = metro.api;
export const PendingReplyStore = metro.findStore('PendingReply', { lazy: true });
export const CloudUploader = metro.findByProps('CloudUpload', { lazy: true });
export const ImagePicker = metro.findByProps('launchImageLibraryAsync', { lazy: true });

export const settings = storage.getStore('astral.custom-commands');
export const Patcher = patcher.createPatcher('astral.custom-commands');
