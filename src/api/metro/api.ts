import { findByProps } from '@api/metro';

export const Messages = findByProps('sendMessage', 'receiveMessage', { lazy: true });
export const Linking = findByProps('openURL', 'openDeeplink', { lazy: true });
export const Profiles = findByProps('showUserProfile', { lazy: true });
export const AsyncUsers = findByProps('fetchProfile', { lazy: true });