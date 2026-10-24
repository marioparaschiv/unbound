import { metro, patcher } from '@unbound-app/api';

export const Avatars = metro.findByProps('SummarizedIconRow', 'Avatar', 'AvatarSizes', {
	lazy: true,
});

export const UserStore = metro.stores.Users;

export const Patcher = patcher.createPatcher('unbound.typing-avatars');
