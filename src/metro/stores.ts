import { findStore } from '@metro';

export const Guilds = findStore('Guilds', { lazy: true });
export const Theme = findStore('Theme', { lazy: true });
export const Users = findStore('User', { lazy: true });
