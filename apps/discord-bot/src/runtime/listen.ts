import { setTimeout as sleep } from 'node:timers/promises';
import { createLogger } from '@unbound-app/logger';
import postgres from 'postgres';

import type { NotifyChannel } from '~/dispatchers/types';

const logger = createLogger('Bot', 'Listen');

export type Unlisten = () => Promise<void>;

export type Backoff = {
	initialMs: number;
	maxMs: number;
};

export type ListenOptions = {
	/** The connection string; each attempt opens its own single-connection client. */
	url: string;
	channel: NotifyChannel;
	/** Receives each notification's payload. */
	handler: (payload: string) => Promise<void>;
	/** Converges every row; runs after each (re)subscribe and is retried until it succeeds. */
	reconcile: () => Promise<void>;
	backoff?: Backoff;
};

// postgres.js reads `onnotify` at runtime but leaves it out of its option types.
type ListenClientOptions = postgres.Options<Record<string, never>> & {
	onnotify: (channel: string, payload: string) => void;
};

export const DEFAULT_BACKOFF: Backoff = { initialMs: 500, maxMs: 30_000 };

function delayFor(backoff: Backoff, attempt: number) {
	return Math.min(backoff.initialMs * 2 ** attempt, backoff.maxMs);
}

/**
 * @description Subscribes to a NOTIFY channel on a supervised connection that reconnects with capped backoff.
 * @param options The connection string, channel, handler, reconcile and backoff.
 * @returns A function that stops retrying, closes the connection and resolves once the supervisor has exited.
 */
export function listen(options: ListenOptions): Unlisten {
	const { url, channel, handler, reconcile, backoff = DEFAULT_BACKOFF } = options;
	const controller = new AbortController();
	const { signal } = controller;
	const stopped = new Promise<void>((resolve) => {
		signal.addEventListener('abort', () => resolve(), { once: true });
	});

	let client: postgres.Sql | undefined;
	let subscription = 0;

	async function wait(ms: number) {
		await sleep(ms, undefined, { signal }).catch(() => void 0);
	}

	async function handle(payload: string) {
		try {
			await handler(payload);
		} catch (error) {
			logger.error(`Failed to handle ${payload} on ${channel}:`, error);
		}
	}

	// A newer subscription runs its own reconcile, so an older loop gives up once superseded.
	async function reconcileUntilDone(current: number) {
		for (let attempt = 0; !signal.aborted && current === subscription; attempt++) {
			try {
				await reconcile();

				return;
			} catch (error) {
				const ms = delayFor(backoff, attempt);

				logger.error(`Failed to reconcile ${channel}, retrying in ${ms}ms:`, error);
				await wait(ms);
			}
		}
	}

	async function supervise() {
		let failures = 0;
		let dropped = false;

		while (!signal.aborted) {
			const closed = Promise.withResolvers<void>();
			const clientOptions: ListenClientOptions = {
				max: 1,
				max_lifetime: null,
				fetch_types: false,
				connection: { application_name: `unbound-bot-${channel}` },
				onnotice: () => void 0,
				onclose: () => closed.resolve(),
				onnotify: (name, payload) => {
					if (name === channel) {
						void handle(payload);
					}
				},
			};
			const sql = postgres(url, clientOptions);

			client = sql;

			try {
				await sql.unsafe(`LISTEN "${channel}"`);
			} catch (error) {
				const ms = delayFor(backoff, failures++);

				logger.warn(`Failed to listen on ${channel}, retrying in ${ms}ms:`, error);
				await sql.end({ timeout: 0 });
				await wait(ms);

				continue;
			}

			if (dropped) {
				logger.success(
					`Listening on ${channel} again after ${failures} failed attempt(s).`,
				);
			}

			failures = 0;
			void reconcileUntilDone(++subscription);
			await Promise.race([closed.promise, stopped]);
			await sql.end({ timeout: 0 });

			if (signal.aborted) return;

			dropped = true;
			logger.warn(`Lost the connection listening on ${channel}; reconnecting.`);
		}
	}

	const supervisor = supervise();

	return async () => {
		controller.abort();
		await client?.end({ timeout: 0 });
		await supervisor;
	};
}

export default { DEFAULT_BACKOFF, listen };
