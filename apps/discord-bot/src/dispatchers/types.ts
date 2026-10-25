import type { Client } from 'discord.js';

import type { Database } from '~/db/database';

export type NotifyChannel = 'addon_changed' | 'audit_event' | 'loader_release' | 'member_changed';

export type DispatcherContext = {
	db: Database;
	client: Client<true>;
};

export type Dispatcher = {
	name: string;
	channel: NotifyChannel;
	/** Brings every row's Discord message in line with the row; runs on each (re)connect. */
	reconcile: (context: DispatcherContext) => Promise<void>;
	/** Brings the Discord message of the row named by a NOTIFY payload in line with the row. */
	handle: (payload: string, context: DispatcherContext) => Promise<void>;
};
