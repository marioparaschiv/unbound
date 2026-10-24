import { metro, patcher, storage } from '@unbound-app/api';

export const UserProfileCard = metro.findByFilePath(
	'modules/user_profile/native/UserProfileCard.tsx',
	{ interop: false, lazy: true },
);

export const UserProfileCardByName = metro.findByName('UserProfileCard', {
	interop: false,
	lazy: true,
});

// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });
export const RelationshipStore = metro.findStore('Relationship', { lazy: true });

export const settings = storage.getStore('unbound.reviewdb');
export const Patcher = patcher.createPatcher('unbound.reviewdb');
