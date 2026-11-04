import { flux, metro } from '@unbound-app/api';

export const UserProfileCard = metro.findByFilePath(
	'modules/user_profile/native/UserProfileCard.tsx',
);

export const RelationshipStore = flux.getStore('Relationship');
export const UserStore = flux.getStore('User');
