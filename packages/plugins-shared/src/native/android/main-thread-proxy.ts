import type {
	NativeJavaArgument,
	NativeJavaValue,
	NativeUIBridge,
	NativeUIScope,
} from '@unbound-app/api/native';

import { attachMainThreadProxy, type ProxyAttachment } from './main-thread-proxy-worklets';

/** A Java interface implemented on the main thread, with fixed answers, for listeners Android calls there and waits on. */
export type MainThreadProxyOptions = {
	/** The interfaces the proxy implements, such as `android.view.View$OnTouchListener`. */
	interfaces: string[];
	/** What each method returns at once; a method not listed returns its type's default. */
	answers?: Record<string, NativeJavaArgument>;
	/** The method that receives the proxy as its last argument, called on the main thread. */
	attach: ProxyAttachment;
};

/**
 * @description Makes a Java proxy on the main thread without a hand-written worklet: Android gets each answer synchronously, and `listener` hears every call on the JS thread.
 * @param ui The plugin's UI bridge, `context.native.ui`.
 * @param scope A UI scope from `ui.createScope()`, which removes the proxy on dispose.
 * @param options The interfaces, the fixed answers, and where the proxy goes.
 * @param listener Runs on the JS thread with each call's method and arguments.
 * @returns The method's result.
 */
export function mainThreadProxy(
	ui: NativeUIBridge,
	scope: NativeUIScope,
	options: MainThreadProxyOptions,
	listener: (method: string, args: NativeJavaValue[]) => void,
): Promise<NativeJavaValue | null> {
	return ui.call(
		attachMainThreadProxy as never,
		scope,
		options.interfaces,
		(options.answers ?? {}) as never,
		options.attach as never,
		ui.callback(listener as never),
	) as Promise<NativeJavaValue | null>;
}
