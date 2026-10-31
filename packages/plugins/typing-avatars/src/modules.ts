import { metro, flux } from '@unbound-app/api';

export const Avatars = metro.findByProps('SummarizedIconRow', 'Avatar', 'AvatarSizes', {
	lazy: true,
});

export const UserStore = flux.getStore('User', { lazy: true });
