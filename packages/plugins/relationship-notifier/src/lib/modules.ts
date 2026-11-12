import { flux, metro } from '@unbound-app/api';

import type {} from '~/lib/types';

export const UserStore = flux.getStore('User', { lazy: true });
export const GuildStore = flux.getStore('Guild', { lazy: true });
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const RelationshipStore = flux.getStore('Relationship', { lazy: true });
export const GuildAvailabilityStore = flux.getStore('GuildAvailability', { lazy: true });
export const GatewayConnectionStore = flux.getStore('GatewayConnection', { lazy: true });
export const LurkingStore = flux.getStore('Lurking', { lazy: true });

export const { AsyncUsers, Profiles } = metro.api;
