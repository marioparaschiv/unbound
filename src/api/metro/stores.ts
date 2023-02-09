import { findStore } from '@metro';

export const Guilds = findStore('Guild', { lazy: true });
export const Theme = findStore('Theme', { lazy: true });
export const Users = findStore('User', { lazy: true });