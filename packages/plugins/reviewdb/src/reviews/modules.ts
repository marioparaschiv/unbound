import { flux, metro } from '@unbound-app/api';

// The profile card's file, else its name for a build that moved it.
export const UserProfileCard = metro.find(
	metro.filters.any(
		metro.filters.byFilePath('modules/user_profile/native/UserProfileCard.tsx'),
		metro.filters.byName('UserProfileCard'),
	),
	{ interop: false },
);

export const RelationshipStore = flux.getStore('Relationship');
export const UserStore = metro.stores.Users;
