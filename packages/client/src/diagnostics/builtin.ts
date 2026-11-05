import { createPatcher } from '~/patcher/create-patcher';
import { findByProps } from '~/metro/search';

import { logRejection } from './promise-rejections';

const Patcher = createPatcher('unbound::promise-rejections');

// @sentry/core: Sentry's rejection tracker reports each unhandled rejection through its captureException.
const SentryCore = findByProps('captureException', 'createEventEnvelope', { lazy: true });

type SentryHint = { data?: { id?: number }; mechanism?: { type?: string } };

/**
 * Logs the unhandled rejections Sentry's tracker reports. Sentry replaces Unbound's early tracker while
 * Discord starts, and its reports go nowhere since Unbound blocks the Sentry SDK.
 */
export function start() {
	// UNKNOWN: Sentry captures whatever the promise was rejected with.
	Patcher.before(SentryCore, 'captureException', ({ args: [error, hint] }) => {
		const { data, mechanism } = (hint ?? {}) as SentryHint;

		if (mechanism?.type !== 'onunhandledrejection') return;

		logRejection(data?.id, error);
	});
}

/** Stops logging the rejections Sentry reports. */
export function stop() {
	Patcher.unpatchAll();
}

export default { start, stop };
