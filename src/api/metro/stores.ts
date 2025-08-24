import type { Store } from '@typings/discord/flux';
import { findStore } from '@api/metro';


export const Theme = findStore('Theme', { lazy: true }) as Store;
export const Users = findStore('User', { lazy: true }) as Store;
export const Guilds = findStore('Guild', { lazy: true }) as Store;
