import { findByProps } from '@api/metro';

export const Linking = findByProps('openURL', 'openDeeplink', { lazy: true });
export const Profiles = findByProps('showUserProfile', { lazy: true });
export const AsyncUsers = findByProps('fetchProfile', { lazy: true });