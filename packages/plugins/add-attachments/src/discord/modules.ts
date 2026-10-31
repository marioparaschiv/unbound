import { flux, metro } from '@unbound-app/api';

export const { ActionSheets } = metro.api;
export const REST = metro.common.REST;
export const Constants = metro.common.Constants;
export const CloudUploader = metro.findByProps('CloudUpload', { lazy: true });
export const ImagePicker = metro.findByProps('launchImageLibraryAsync', { lazy: true });
export const MessageStore = flux.getStore('Message', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });
export const PermissionStore = flux.getStore('Permission', { lazy: true });
export const EditMessageStore = flux.getStore('EditMessage', { lazy: true });
