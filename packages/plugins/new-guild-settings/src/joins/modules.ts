import { flux, metro } from '@unbound-app/api';

import type { JoinGuildOptions } from '~/joins/join-events';

type GuildActions = {
	joinGuild: (guildId: unknown, options?: JoinGuildOptions) => unknown;
};

export const GuildActions: GuildActions = metro.findByProps('joinGuild', 'waitForGuild');
export const UserStore = flux.getStore('User');
