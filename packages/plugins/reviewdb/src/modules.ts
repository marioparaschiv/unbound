import { metro, storage, flux } from '@unbound-app/api';

// The profile card's file, else its name for a build that moved it.
export const UserProfileCardSources = [
	'modules/user_profile/native/UserProfileCard.tsx',
	metro.filters.byName('UserProfileCard'),
];

// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });
export const RelationshipStore = flux.getStore('Relationship', { lazy: true });

export const settings = storage.getBucket();
