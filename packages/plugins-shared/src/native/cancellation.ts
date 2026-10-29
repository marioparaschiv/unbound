const DISPOSED_CODE = 'NATIVE_PLUGIN_SCOPE_DISPOSED';
const RELEASED_HANDLE = 'The Java handle is unavailable';

type NativeCancellation = Error & { code?: string };

/**
 * @description Whether an error only means native work was cut short: the plugin's native scope was disposed, an async call was cancelled, or a view was released mid-call.
 * @param error The caught error.
 * @returns True when the error is a cancellation rather than a failure worth logging.
 */
export function isCancellation(error: unknown): error is NativeCancellation {
	if (!(error instanceof Error)) {
		return false;
	}

	return Reflect.get(error, 'code') === DISPOSED_CODE || error.message.includes(RELEASED_HANDLE);
}
