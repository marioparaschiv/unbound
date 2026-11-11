import type { NativeJavaHookOptions } from '@unbound-app/api/native';

/**
 * @description Options for a hook that only needs to know which view was called: it hears calls after they run and skips their arguments.
 */
export const RECEIVER_ONLY_AFTER_CALL: NativeJavaHookOptions<true> = {
	notify: 'after',
	payload: { receiver: true, arguments: [] },
};
