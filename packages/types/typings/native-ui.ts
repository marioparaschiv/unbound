import type {
	LoaderObjCBridge,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeSerializable,
} from './native';

/** The bridge methods a plugin may call from the UI runtime, synchronously and on the main thread. */
export type NativeUIScope = {
	readonly objc?: Partial<LoaderObjCBridge>;
	readonly java?: Partial<NativeJavaBridge>;
	readonly hooks?: Partial<NativeJavaHooksBridge>;
	/** Removes every hook the scope installed. */
	dispose(): void;
};

export type NativeUIScopeFactory = {
	/** Opens a UI-runtime scope allowed only the listed method paths, such as `objc.invoke`. */
	createUIScope?(paths: readonly string[]): NativeUIScope;
};

/** Runs plugin worklets on the UI runtime, where native views live, so hooks there act before the next frame. */
export type NativeUIBridge = {
	/** Opens a scope with every synchronous method the plugin's capabilities allow; capture it in a worklet. */
	createScope(): NativeUIScope;
	/** Runs a worklet on the UI runtime and waits for its result. */
	runSync<A extends NativeSerializable[], R>(worklet: (...args: A) => R, ...args: A): R;
	/** Queues a worklet on the UI runtime. */
	run<A extends NativeSerializable[]>(worklet: (...args: A) => void, ...args: A): void;
};
