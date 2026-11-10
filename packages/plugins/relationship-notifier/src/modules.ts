import { flux, metro } from '@unbound-app/api';

import type {} from '~/types';

export const UserStore = flux.getStore('User', { lazy: true });
export const GuildStore = flux.getStore('Guild', { lazy: true });
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const RelationshipStore = flux.getStore('Relationship', { lazy: true });
export const GuildAvailabilityStore = flux.getStore('GuildAvailability', { lazy: true });
export const GatewayConnectionStore = flux.getStore('GatewayConnection', { lazy: true });
export const LurkingStore = flux.getStore('Lurking', { lazy: true });

export type RestClient = Record<'del' | 'post', (request: unknown) => Promise<unknown>>;

export const REST: RestClient = metro.common.REST;

export const RELATIONSHIP_ACTIONS_FILTER = metro.filters.byProps('removeRelationship');
export const GUILD_ACTIONS_FILTER = metro.filters.byProps('leaveGuild');
export const PRIVATE_CHANNEL_ACTIONS_FILTER = metro.filters.byProps('closePrivateChannel');

export const { AsyncUsers, Profiles } = metro.api;
