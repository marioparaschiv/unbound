import type {
	NativeCancelablePromise,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeObjCBridge,
	NativeSerializable,
} from './native';

/** The bridge methods a plugin may call from the UI runtime, synchronously and on the main thread. */
export type NativeUIScope = {
	/** The Objective-C methods the scope allows; present on iOS. */
	readonly objc?: NativeObjCBridge;
	/** The Java methods the scope allows; present on Android. */
	readonly java?: NativeJavaBridge;
	/** The Java hook methods the scope allows; present on Android. Listeners run inline for calls on the main thread. */
	readonly hooks?: NativeJavaHooksBridge;
	/** Removes every hook the scope installed. */
	dispose(): void;
};

/** The loader's way to open UI-runtime scopes, offered on its raw `objc` namespace on iOS and `java` on Android. */
export type NativeUIScopeFactory = {
	/** Opens a UI-runtime scope allowed only the listed method paths, such as `objc.invoke`. */
	createUIScope(paths: readonly string[]): NativeUIScope;
};

/** A function a worklet calls on the UI runtime to hand serializable values to a listener on the JS thread, made with `callback`. */
export type NativeUICallback<A extends NativeSerializable[] = NativeSerializable[]> = {
	call(...args: A): void;
}['call'];

/** A value a worklet can take from the JS runtime: a serializable value, a UI scope, which is shared as is, or a callback into the JS thread. */
export type NativeUIArgument = NativeSerializable | NativeUIScope | NativeUICallback;

/** Runs plugin worklets on the UI runtime, where native views live, so hooks there act before the next frame. */
export type NativeUIBridge = {
	/** Opens a scope with every synchronous method the plugin's capabilities allow; capture it in a worklet. */
	createScope(): NativeUIScope;
	/** Runs a worklet on the UI runtime and resolves with what it returns, which must be serializable. */
	call<A extends NativeUIArgument[], R extends NativeSerializable | void>(
		worklet: (...args: A) => R,
		...args: A
	): NativeCancelablePromise<R>;
	/** Queues a worklet on the UI runtime. */
	run<A extends NativeUIArgument[]>(worklet: (...args: A) => void, ...args: A): void;
	/** Wraps a JS-thread listener so a worklet can call it, for example to wake JS only for the hook events that need it; it stops calling the listener once the plugin stops. */
	callback<A extends NativeSerializable[]>(listener: (...args: A) => void): NativeUICallback<A>;
};
