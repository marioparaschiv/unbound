type DeviceHandle = { readonly __deviceHandle?: never };

type DeviceCancellable<T> = Promise<T> & { cancel(): void };

type DeviceHookToken = { remove(): void };

type DeviceObjC = {
	getClass(name: string): DeviceHandle;
	call(target: DeviceHandle, selector: string, ...args: unknown[]): DeviceHandle;
	invokeAsync(
		target: DeviceHandle,
		selector: string,
		args: unknown[],
	): DeviceCancellable<unknown>;
	hook(className: string, selector: string, handlers: { after?: () => void }): DeviceHookToken;
};

type DeviceJava = {
	getClass(name: string): DeviceHandle;
	getField(target: DeviceHandle, name: string): DeviceHandle;
	construct(name: string, args: unknown[]): DeviceHandle;
	release(handle: DeviceHandle): void;
	invokeAsync(target: DeviceHandle, name: string, args: unknown[]): DeviceCancellable<unknown>;
};

type DeviceJavaHooks = {
	hook(
		className: string,
		methodName: string,
		parameterTypes: string[],
		options: { notify: boolean },
		listener: () => void,
	): unknown;
	remove(token: unknown): void;
};

type DevicePluginContext = {
	platform: string;
	capabilities?: string[];
	native?: { objc: DeviceObjC; java: DeviceJava; hooks: DeviceJavaHooks };
};

type DevicePluginInstance = {
	selfTest?(): unknown;
	getSettingsPanel?(): unknown;
};

type DeviceEntity = {
	id: string;
	started: boolean;
	bundle?: unknown;
	data: { name: string };
	instance?: DevicePluginInstance | null;
	context?: DevicePluginContext;
};

type DeviceStore = {
	get(key: string, fallback: unknown): unknown;
	set(key: string, value: unknown): void;
	remove(key: string): void;
};

type DeviceMessage = {
	id: string;
	content?: string;
	author?: { bot?: boolean };
};

type DeviceUnbound = {
	plugins: {
		entities: Map<string, DeviceEntity>;
		errors: Map<string, unknown>;
		getEntity(id: string): DeviceEntity | undefined;
		start(id: string): Promise<void>;
		stop(id: string): Promise<void>;
		reload(
			id: string,
			bundle: unknown,
			data: unknown,
		): Promise<{ ok: boolean; error?: unknown }>;
	};
	native?: {
		getNativeResources?: () => { hooks: number } | null;
		BundleInfo?: { Version?: string; Build?: string };
	};
	storage: { getStore(name: string): DeviceStore };
	fs: { read(path: string, encoding?: string): unknown };
	metro: {
		common: {
			React: {
				Component: { prototype: object; call(self: unknown, props: object): void };
				createElement(
					type: unknown,
					props?: object | null,
					...children: unknown[]
				): unknown;
			};
		};
		findByProps<T>(...names: string[]): T;
		findStore<T>(name: string): T;
	};
};

declare const unbound: DeviceUnbound;

declare const HermesInternal:
	| { getInstrumentedStats?: () => { js_allocatedBytes: number } }
	| undefined;

declare function gc(): void;
