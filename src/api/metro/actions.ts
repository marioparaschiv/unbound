import { findByProps } from '@metro';

export const Linking = findByProps('openURL', 'openDeeplink', { lazy: true });