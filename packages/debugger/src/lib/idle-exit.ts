/**
 * @description Calls `onIdle` once no controller has been attached for `timeoutMs`. The timer starts
 * at once, so a bridge whose spawner never connects still ends.
 * @param timeoutMs How long the bridge may sit without a controller.
 * @param onIdle What to run when that time passes, such as exiting the process.
 * @returns A listener for the controller count: 0 restarts the timer, anything else cancels it.
 */
export function createIdleExit(timeoutMs: number, onIdle: () => void): (count: number) => void {
	let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(onIdle, timeoutMs);

	return (count) => {
		clearTimeout(timer);
		timer = count === 0 ? setTimeout(onIdle, timeoutMs) : undefined;
	};
}

export default createIdleExit;
