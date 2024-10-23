/**
 * @description Creates an AbortController that aborts after the specified timeout. Useful for requests.
 * @param ms The milliseconds to abort after.
 * @return An AbortSignal with the configured timeout.
 */
function createTimeoutSignal(ms: number = 5000) {
	const controller = new AbortController();

	setTimeout(() => {
		controller.abort(`Timeout of ${ms}ms exceeded.`);
	}, ms);

	return controller.signal;
}

export default createTimeoutSignal;