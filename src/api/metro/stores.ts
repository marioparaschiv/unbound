import { findStore } from '@api/metro';


export const Theme = findStore('Theme', { lazy: true });
export const Users = findStore('User', { lazy: true });
export const Guilds = findStore('Guild', { lazy: true });
