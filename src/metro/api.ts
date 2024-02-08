import { findByProps } from '@metro';

export const [
	Linking,
	AsyncUsers,
	Profiles
] = [
		findByProps('openURL', 'openDeeplink', { lazy: true }),
		findByProps('fetchProfile', { lazy: true }),
		findByProps('showUserProfile', { lazy: true })
	];