import type { NativeJavaHookOptions } from '@unbound-app/api/native';

/**
 * @description Options for a hook that only needs to know which view was called: it hears calls after they run, skips their arguments and delivers only the latest pending call per receiver.
 */
export const LATEST_CALL_PER_RECEIVER: NativeJavaHookOptions<true> = {
	notify: 'after',
	coalesce: 'receiver',
	payload: { receiver: true, arguments: [] },
};

/**
 * @description Like {@link LATEST_CALL_PER_RECEIVER}, keeping only the call's first argument, such as the message a view was bound to.
 */
export const LATEST_BIND_PER_RECEIVER: NativeJavaHookOptions<true> = {
	notify: 'after',
	coalesce: 'receiver',
	payload: { receiver: true, arguments: [0] },
};
