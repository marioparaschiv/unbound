import { findByProps } from '@metro';

export const Themes = findByProps('updateTheme', 'overrideTheme', { lazy: true });
export const Dialog = findByProps('show', 'close', 'openLazy', { lazy: true });
export const Profiles = findByProps('showUserProfile', { lazy: true });