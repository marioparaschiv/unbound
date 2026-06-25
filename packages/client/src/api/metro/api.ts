import { findByPropsLazy } from '~/api/metro/wrappers';

export const Messages = findByPropsLazy('sendMessage', 'receiveMessage');
export const Linking = findByPropsLazy('openURL', 'openSettings');
export const Profiles = findByPropsLazy('showUserProfile');
export const AsyncUsers = findByPropsLazy('fetchProfile');
