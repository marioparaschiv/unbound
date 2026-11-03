import type { NativeHookOptions } from '@unbound-app/api/native';

/**
 * @description Options for an `after` hook that only needs to know which object was called: the native side skips the call's arguments and delivers only the latest pending call per receiver.
 */
export const LATEST_CALL_PER_RECEIVER: NativeHookOptions<true> = {
	coalesce: 'receiver',
	payload: { receiver: true, arguments: [] },
};

export default LATEST_CALL_PER_RECEIVER;
