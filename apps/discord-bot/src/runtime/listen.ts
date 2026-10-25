import { createLogger } from '@unbound-app/logger';
import type { Sql } from 'postgres';

import type { NotifyChannel } from '~/dispatchers/types';

const logger = createLogger('Bot', 'Listen');

export type Unlisten = () => Promise<void>;

/**
 * @description Subscribes to a NOTIFY channel. Notifications sent while disconnected are lost, so
 * `reconcile` runs after the first connect and after every reconnect.
 * @param sql The postgres.js client; it keeps one dedicated connection for all its listeners.
 * @param channel The channel to `LISTEN` on.
 * @param handler Receives each notification's payload.
 * @param reconcile Converges every row, covering notifications missed while disconnected.
 * @returns A function that stops listening.
 */
export async function listen(
	sql: Sql,
	channel: NotifyChannel,
	handler: (payload: string) => Promise<void>,
	reconcile: () => Promise<void>,
): Promise<Unlisten> {
	async function run(task: () => Promise<void>, action: string) {
		try {
			await task();
		} catch (error) {
			logger.error(`Failed to ${action} on ${channel}:`, error);
		}
	}

	const subscription = await sql.listen(
		channel,
		(payload) => void run(() => handler(payload), `handle ${payload}`),
		() => void run(reconcile, 'reconcile'),
	);

	return () => subscription.unlisten();
}

export default { listen };
