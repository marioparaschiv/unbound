import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';

/** One native hook a plugin asked for that the loader could not install. */
export type HookFailure = { addon: string; target: string; reason: string };

const MAX_HOOK_FAILURES = 5;
const MAX_REASON_LENGTH = 120;

const logger = createLogger('Native', 'Hooks');
const failures: HookFailure[] = [];

/**
 * @description Names a hooked method in one line: `Class.method(signature)`, or `Class -selector` for Objective-C.
 * @param className The class.
 * @param method The Java method name or Objective-C selector.
 * @param parameterTypes The Java parameter types; omitted for Objective-C.
 * @returns The target.
 */
export function hookTarget(className: string, method: string, parameterTypes?: string[]): string {
	return parameterTypes
		? `${className}.${method}(${parameterTypes.join(', ')})`
		: `${className} ${method.startsWith('+') ? method : `-${method}`}`;
}

/**
 * @description Logs and remembers, for `/debug`, a hook that failed to install, keeping the newest five.
 * @param addon The plugin that asked for the hook.
 * @param target The hooked method, from {@link hookTarget}.
 * @param error What the loader threw.
 */
// UNKNOWN: the loader throws whatever its bridge raised.
export function recordHookFailure(addon: string, target: string, error: unknown): void {
	logger.warn(`Failed to hook ${target} for ${addon}:`, error);

	failures.push({ addon, target, reason: toError(error).message.slice(0, MAX_REASON_LENGTH) });

	if (failures.length > MAX_HOOK_FAILURES) {
		failures.shift();
	}
}

/**
 * @description Lists the newest hooks that failed to install, oldest first.
 * @returns A copy of the recorded failures.
 */
export function hookFailures(): HookFailure[] {
	return [...failures];
}
