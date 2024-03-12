import { fastFindByProps } from '@metro';

export const Linking = fastFindByProps('openURL', 'openDeeplink', { lazy: true });
export const AsyncUsers = fastFindByProps('fetchProfile', { lazy: true });
export const Profiles = fastFindByProps('showUserProfile', { lazy: true });