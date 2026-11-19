import type { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';

export const SLOW_START_MS = 5000;

type AsyncStart = {
	name: string;
	logger: Pick<ReturnType<typeof createLogger>, 'warn'>;
	onSettled: () => void;
	onFailed: (failure: Error) => void;
};

/**
 * @description Follows an addon's async start in the background: settles it, records a rejection, and warns once when
 * it is still running after {@link SLOW_START_MS}, since launch went on without it.
 * @param starting What the addon's start returned.
 * @param handlers The addon's name, the manager's logger, and what to do once it settles or fails.
 */
export function followAsyncStart(
	starting: PromiseLike<unknown>,
	{ name, logger, onSettled, onFailed }: AsyncStart,
): void {
	const slow = setTimeout(
		() => logger.warn(`${name} is still starting after ${SLOW_START_MS / 1000} seconds.`),
		SLOW_START_MS,
	);

	starting.then(
		() => {
			clearTimeout(slow);
			onSettled();
		},
		(cause: unknown) => {
			clearTimeout(slow);
			onSettled();
			onFailed(toError(cause));
		},
	);
}

export default followAsyncStart;
