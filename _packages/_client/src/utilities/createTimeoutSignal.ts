/**
 * @description Creates an AbortController that aborts after the specified timeout. Useful for requests.
 * @param ms The milliseconds to abort after.
 * @return An AbortSignal with the configured timeout.
 */
function createTimeoutSignal(ms: number = 5000): AbortController['signal'] {
	const controller = new AbortController();

	setTimeout(() => {
		if (controller.signal.aborted) return;
		controller.abort(`Timeout of ${ms}ms exceeded.`);
	}, ms);

	return controller.signal;
}

export default createTimeoutSignal;