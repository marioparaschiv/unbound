import type { BotReads } from '@unbound-app/web/bot';

import type { Database } from '~/db/database';

/** The channels the bot's trigger migrations `pg_notify`; `tests/notify-channels.test.ts` checks the SQL agrees. */
export const NOTIFY_CHANNELS = [
	'addon_changed',
	'audit_event',
	'loader_release',
	'member_changed',
] as const;

export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

/** The two stores each call reads and writes; Discord and the configuration enter when a dispatcher is built. */
export type DispatcherContext = {
	/** The bot's own schema: posted state, grants, tags. */
	db: Database;
	/** The web's tables, read only. */
	web: BotReads;
};

export type Dispatcher = {
	name: string;
	channel: NotifyChannel;
	/** Brings every Discord message in line with the web's data; runs on each (re)connect and on a timer. */
	reconcile: (context: DispatcherContext) => Promise<void>;
	/** Brings the Discord message of the subject a NOTIFY payload names in line with the web's data. */
	handle: (payload: string, context: DispatcherContext) => Promise<void>;
};
