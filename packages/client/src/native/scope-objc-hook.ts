import type {
	NativeObjCBridge,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
} from '@unbound-app/types';

import type { ScopeGate, ScopeLifecycle } from '~/native/scope-gate';
import { NativeBridgeDisposedError } from '~/native/errors';
import { hookTarget, recordHookFailure } from '~/diagnostics/hook-failures';
import { retryUntilInstalled } from '~/native/hook-retry';

type ObjCSource = Pick<NativeObjCBridge, 'hook' | 'getClass'> &
	Partial<Pick<NativeObjCBridge, 'findClasses'>>;

/**
 * @description Builds a plugin scope's `objc.hook`, which can also hook every subclass that implements the
 * selector itself and wait for a class Discord has not loaded yet.
 * @param objcBridge The loader's Objective-C bridge, attributed to the plugin.
 * @param tokens The scope's installed hooks, which it removes on dispose.
 * @param lifecycle Whether the scope is disposed.
 * @param requireGranted Throws when the plugin did not declare a method's capability.
 * @param owner The plugin's id, named when a hook fails to install.
 * @returns The scoped `hook`.
 */
export function createScopedObjCHook(
	objcBridge: ObjCSource,
	tokens: Set<NativeHookToken>,
	lifecycle: ScopeLifecycle,
	requireGranted: ScopeGate['requireGranted'],
	owner = 'unknown',
) {
	return <Receiver extends boolean = true>(
		className: string,
		selector: string,
		handlers: NativeHookHandlers<Receiver>,
		options?: NativeHookOptions<Receiver>,
	) => {
		if (lifecycle.disposed) {
			throw new NativeBridgeDisposedError();
		}

		requireGranted('objc.hook');

		const { subclasses, waitForClass, ...nativeOptions } = options ?? {};
		const installed: NativeHookToken[] = [];

		function install(name: string) {
			let token: NativeHookToken;

			try {
				token = objcBridge.hook<Receiver>(name, selector, handlers, nativeOptions);
			} catch (error) {
				recordHookFailure(owner, hookTarget(name, selector), error);
				throw error;
			}

			tokens.add(token);
			installed.push(token);
		}

		function installAll() {
			install(className);

			if (!subclasses) return;

			const names =
				objcBridge.findClasses?.({
					superclass: className,
					ownMethods: [selector],
					limit: 1000,
				}) ?? [];

			for (const name of names) install(name);
		}

		const retry =
			waitForClass && !objcBridge.getClass(className)
				? retryUntilInstalled(() => {
						if (lifecycle.disposed) {
							return true;
						}

						if (!objcBridge.getClass(className)) {
							return false;
						}

						installAll();

						return true;
					})
				: undefined;

		if (!retry) {
			installAll();
		}

		return {
			get active() {
				return installed.some((token) => token.active);
			},
			setReturnValue(self, args, value) {
				if (lifecycle.disposed) {
					throw new NativeBridgeDisposedError();
				}

				for (const token of installed) token.setReturnValue(self, args, value);
			},
			removeReturnValue(self, args) {
				if (lifecycle.disposed) {
					throw new NativeBridgeDisposedError();
				}

				for (const token of installed) token.removeReturnValue(self, args);
			},
			clearReturnValues() {
				if (lifecycle.disposed) {
					throw new NativeBridgeDisposedError();
				}

				for (const token of installed) token.clearReturnValues();
			},
			remove() {
				retry?.cancel();

				for (const token of installed) {
					token.remove();
					tokens.delete(token);
				}
			},
		};
	};
}

export default { createScopedObjCHook };
