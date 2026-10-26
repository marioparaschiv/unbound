import type { BotReads } from '@unbound-app/web/bot';
import type { Client } from 'discord.js';

import type { IdConstantName } from '~/lib/constants';
import type { Database } from '~/db/database';

export type NotifyChannel = 'addon_changed' | 'audit_event' | 'loader_release' | 'member_changed';

export type DispatcherContext = {
	/** The bot's own schema: posted state, grants, tags. */
	db: Database;
	/** The web's tables, read only. */
	web: BotReads;
	client: Client<true>;
};

/** The two stores a sync reads and writes, without the Discord client. */
export type Stores = Pick<DispatcherContext, 'db' | 'web'>;

export type Dispatcher = {
	name: string;
	channel: NotifyChannel;
	/** The id constants it needs; it is not started while any is still `'0'`. */
	requires: readonly IdConstantName[];
	/** Brings every Discord message in line with the web's data; runs on each (re)connect and on a timer. */
	reconcile: (context: DispatcherContext) => Promise<void>;
	/** Brings the Discord message of the subject a NOTIFY payload names in line with the web's data. */
	handle: (payload: string, context: DispatcherContext) => Promise<void>;
};
