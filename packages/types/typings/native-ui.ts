import type {
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
	createUIScope?(paths: readonly string[]): NativeUIScope;
};

/** A value a worklet can take from the JS runtime: a serializable value or a UI scope, which is shared as is. */
export type NativeUIArgument = NativeSerializable | NativeUIScope;

/** Runs plugin worklets on the UI runtime, where native views live, so hooks there act before the next frame. */
export type NativeUIBridge = {
	/** Opens a scope with every synchronous method the plugin's capabilities allow; capture it in a worklet. */
	createScope(): NativeUIScope;
	/** Runs a worklet on the UI runtime and resolves with what it returns, which must be serializable. */
	call<A extends NativeUIArgument[], R extends NativeSerializable | void>(
		worklet: (...args: A) => R,
		...args: A
	): Promise<R>;
	/** Queues a worklet on the UI runtime. */
	run<A extends NativeUIArgument[]>(worklet: (...args: A) => void, ...args: A): void;
};
