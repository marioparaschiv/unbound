import { metro } from '@unbound-app/api';

export const Avatars = metro.findByProps('SummarizedIconRow', 'Avatar', 'AvatarSizes');
export const TypingIndicator = metro.findByFilePath('modules/chat/native/TypingIndicator.tsx');

export const UserStore = metro.stores.Users;
