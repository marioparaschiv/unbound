import { metro, storage, flux } from '@unbound-app/api';

export const { Commands } = metro.common;
export const Messages = metro.findByProps('sendMessage', 'receiveMessage');
export const PendingReplyStore = flux.getStore('PendingReply');
export const CloudUploader = metro.findByProps('CloudUpload');
export const ImagePicker = metro.findByProps('launchImageLibraryAsync');

export const settings = storage.getBucket();
