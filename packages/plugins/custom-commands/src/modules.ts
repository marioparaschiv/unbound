import { metro, storage, flux } from '@unbound-app/api';

export const { Commands } = metro.common;
export const { Messages } = metro.api;
export const PendingReplyStore = flux.getStore('PendingReply', { lazy: true });
export const CloudUploader = metro.findByProps('CloudUpload', { lazy: true });
export const ImagePicker = metro.findByProps('launchImageLibraryAsync', { lazy: true });

export const settings = storage.getBucket();
