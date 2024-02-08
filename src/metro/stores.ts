import { findStore } from '@metro';

export const [
	Guilds,
	Theme,
	Users
] = [
		findStore('Guild', { lazy: true }),
		findStore('Theme', { lazy: true }),
		findStore('User', { lazy: true })
	];