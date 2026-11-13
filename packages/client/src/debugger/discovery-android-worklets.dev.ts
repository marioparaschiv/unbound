import type {
	NativeJavaArgument,
	NativeJavaBridge,
	NativeJavaProxyCall,
	NativeJavaReference,
	NativeJavaValue,
	NativeUICallback,
} from '@unbound-app/types';

/** The Java methods a browse calls on the UI runtime. */
export type DiscoveryJava = Pick<NativeJavaBridge, 'getField' | 'invoke'> & {
	getClass(name: string): NativeJavaReference;
	construct(name: string, args?: NativeJavaArgument[]): NativeJavaReference;
};

/** A Java object a proxy implements interfaces with. */
export type DiscoveryProxy = { object: NativeJavaReference };

/** The part of a UI scope a browse uses: Java calls, Java proxies, and disposal. */
export type DiscoveryScope = {
	readonly java?: DiscoveryJava;
	readonly hooks?: {
		proxy(interfaces: string[], handler: (call: NativeJavaProxyCall) => void): DiscoveryProxy;
	};
	dispose(): void;
};

/** A service as `NsdManager` resolved it, read on the UI runtime and handed to the JS thread. */
export type ResolvedService = {
	/** The service instance name, which a bridge sets to its computer's name. */
	computer: string;
	/** Every address the service resolved to, as `InetAddress.getHostAddress()` writes them. */
	hosts: string[];
	port: number;
	/** The TXT entries read for the requested keys. */
	txt: Record<string, string>;
};

export type DiscoveryConfig = {
	/** The UI-runtime global this browse keeps its state under. */
	stateKey: string;
	/** The DNS-SD service type, such as `_unbound-bridge._tcp`. */
	serviceType: string;
	/** The TXT keys to read from each resolved service. */
	txtKeys: string[];
};

export type DiscoveryCallbacks = {
	found: NativeUICallback<[ResolvedService]>;
	lost: NativeUICallback<[string]>;
	failed: NativeUICallback<[string, string, string]>;
};

type Pending = { name: string; info: NativeJavaReference };

type DiscoveryState = {
	config: DiscoveryConfig;
	callbacks: DiscoveryCallbacks;
	scope: DiscoveryScope;
	java: DiscoveryJava;
	nsd: NativeJavaReference;
	listener: NativeJavaReference | undefined;
	resolver: NativeJavaReference | undefined;
	queue: Pending[];
	resolving: boolean;
	browsing: boolean;
};

const PROTOCOL_DNS_SD = 1;

function holder(): Record<string, DiscoveryState | undefined> {
	'worklet';

	return globalThis as typeof globalThis & Record<string, DiscoveryState | undefined>;
}

function reference(value: NativeJavaValue | undefined): NativeJavaReference | undefined {
	'worklet';

	return value?.type === 'handle' ? value : undefined;
}

function text(value: NativeJavaValue | undefined): string {
	'worklet';

	return value?.type === 'string' ? value.value : '';
}

function count(value: NativeJavaValue | undefined): number {
	'worklet';

	return value && 'value' in value && typeof value.value === 'number' ? value.value : 0;
}

function javaString(value: string): NativeJavaArgument {
	'worklet';

	return { type: 'string', value };
}

function javaInt(value: number): NativeJavaArgument {
	'worklet';

	return { type: 'int', value };
}

// Android reports types with a trailing dot on some versions and without it on others.
function sameType(a: string, b: string): boolean {
	'worklet';

	return a.replace(/^\.+|\.+$/g, '') === b.replace(/^\.+|\.+$/g, '');
}

function nameOf(java: DiscoveryJava, info: NativeJavaReference): string {
	'worklet';

	return text(java.invoke(info, 'getServiceName', []));
}

function readTxt(
	java: DiscoveryJava,
	info: NativeJavaReference,
	keys: string[],
): Record<string, string> {
	'worklet';
	const txt: Record<string, string> = {};
	const attributes = reference(java.invoke(info, 'getAttributes', []));

	if (!attributes) {
		return txt;
	}

	// A public copy, since the map Android returns may be a private wrapper class.
	const map = java.construct('java.util.HashMap', [attributes]);

	for (const key of keys) {
		const bytes = reference(java.invoke(map, 'get', [javaString(key)]));

		if (bytes) {
			const decoded = java.construct('java.lang.String', [bytes, javaString('UTF-8')]);

			txt[key] = text(java.invoke(decoded, 'toString', []));
		}
	}

	return txt;
}

function readHosts(java: DiscoveryJava, info: NativeJavaReference): string[] {
	'worklet';
	const hosts: string[] = [];

	try {
		// API 34+ resolves every address; older releases only have `getHost`.
		const addresses = reference(java.invoke(info, 'getHostAddresses', []));
		const list = addresses ? java.construct('java.util.ArrayList', [addresses]) : undefined;
		const size = list ? count(java.invoke(list, 'size', [])) : 0;

		for (let index = 0; list && index < size; index++) {
			const address = reference(java.invoke(list, 'get', [javaInt(index)]));

			if (address) {
				hosts.push(text(java.invoke(address, 'getHostAddress', [])));
			}
		}
	} catch {
		// `getHostAddresses` is missing before API 34; `getHost` below covers those releases.
	}

	if (hosts.length === 0) {
		const host = reference(java.invoke(info, 'getHost', []));

		if (host) {
			hosts.push(text(java.invoke(host, 'getHostAddress', [])));
		}
	}

	return hosts.filter(Boolean);
}

// Before API 34 `NsdManager` resolves one service at a time and fails the rest, so resolves run one after another.
function resolveNext(state: DiscoveryState) {
	'worklet';

	if (state.resolving || !state.resolver) return;

	const next = state.queue.shift();

	if (!next) return;

	state.resolving = true;

	try {
		state.java.invoke(state.nsd, 'resolveService', [next.info, state.resolver]);
	} catch (error) {
		state.resolving = false;
		state.callbacks.failed('resolve bridge', next.name, String(error));
		resolveNext(state);
	}
}

function onDiscovery(stateKey: string, call: NativeJavaProxyCall) {
	'worklet';
	const state = holder()[stateKey];

	if (!state) return;

	const { java, config, callbacks } = state;

	switch (call.method) {
		case 'onServiceFound': {
			const info = reference(call.args[0]);

			if (
				!info ||
				!sameType(text(java.invoke(info, 'getServiceType', [])), config.serviceType)
			)
				return;

			const name = nameOf(java, info);

			if (!state.queue.some((pending) => pending.name === name)) {
				state.queue.push({ name, info });
			}

			resolveNext(state);

			return;
		}
		case 'onServiceLost': {
			const info = reference(call.args[0]);
			const name = info ? nameOf(java, info) : '';

			state.queue = state.queue.filter((pending) => pending.name !== name);

			if (name) {
				callbacks.lost(name);
			}

			return;
		}
		case 'onStartDiscoveryFailed':
		case 'onStopDiscoveryFailed':
			callbacks.failed(
				call.method === 'onStartDiscoveryFailed'
					? 'start browsing for'
					: 'stop browsing for',
				config.serviceType,
				`NsdManager error ${count(call.args[1])}`,
			);
	}
}

function onResolve(stateKey: string, call: NativeJavaProxyCall) {
	'worklet';
	const state = holder()[stateKey];

	if (!state || (call.method !== 'onServiceResolved' && call.method !== 'onResolveFailed')) {
		return;
	}

	const { java, config, callbacks } = state;
	const info = reference(call.args[0]);
	const name = info ? nameOf(java, info) : '';

	state.resolving = false;

	if (call.method === 'onResolveFailed') {
		callbacks.failed('resolve bridge', name, `NsdManager error ${count(call.args[1])}`);
	} else if (info) {
		try {
			callbacks.found({
				computer: name,
				hosts: readHosts(java, info),
				port: count(java.invoke(info, 'getPort', [])),
				txt: readTxt(java, info, config.txtKeys),
			});
		} catch (error) {
			callbacks.failed('read bridge', name, String(error));
		}
	}

	resolveNext(state);
}

function applicationOf(java: DiscoveryJava): NativeJavaReference | undefined {
	'worklet';
	const tracker = reference(
		java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
	);

	return tracker ? reference(java.invoke(tracker, 'application', [])) : undefined;
}

/**
 * @description Starts an `NsdManager` browse on the UI runtime, where Java proxies can answer its listeners.
 * @param scope A UI scope allowing `java.getClass`, `getField`, `invoke`, `construct` and `hooks.proxy`.
 * @param config The state key, service type and TXT keys.
 * @param found Called on the JS thread with each resolved service.
 * @param lost Called on the JS thread with the name of each service that went away.
 * @param failed Called on the JS thread with the operation, its subject and why it failed.
 */
export function startDiscovery(
	scope: DiscoveryScope,
	config: DiscoveryConfig,
	found: DiscoveryCallbacks['found'],
	lost: DiscoveryCallbacks['lost'],
	failed: DiscoveryCallbacks['failed'],
) {
	'worklet';
	const { java, hooks } = scope;

	try {
		const application = java && applicationOf(java);
		const nsd =
			application &&
			reference(
				java.invoke(application, 'getSystemService', [javaString('servicediscovery')]),
			);

		if (!java || !hooks || !nsd) {
			throw new Error('NsdManager is unavailable.');
		}

		const state: DiscoveryState = {
			config,
			callbacks: { found, lost, failed },
			scope,
			java,
			nsd,
			listener: undefined,
			resolver: undefined,
			queue: [],
			resolving: false,
			browsing: false,
		};

		holder()[config.stateKey] = state;
		state.listener = hooks.proxy(['android.net.nsd.NsdManager$DiscoveryListener'], (call) =>
			onDiscovery(config.stateKey, call),
		).object;
		state.resolver = hooks.proxy(['android.net.nsd.NsdManager$ResolveListener'], (call) =>
			onResolve(config.stateKey, call),
		).object;
		java.invoke(nsd, 'discoverServices', [
			javaString(config.serviceType),
			javaInt(PROTOCOL_DNS_SD),
			state.listener,
		]);
		state.browsing = true;
	} catch (error) {
		failed('browse for', config.serviceType, String(error));
		delete holder()[config.stateKey];
		scope.dispose();
	}
}

/**
 * @description Stops a browse {@link startDiscovery} started and removes its listeners.
 * @param stateKey The browse's state key.
 */
export function stopDiscovery(stateKey: string) {
	'worklet';
	const state = holder()[stateKey];

	if (!state) return;

	delete holder()[stateKey];

	try {
		if (state.browsing) {
			state.java.invoke(state.nsd, 'stopServiceDiscovery', [state.listener!]);
		}
	} catch (error) {
		state.callbacks.failed('stop browsing for', state.config.serviceType, String(error));
	}

	state.scope.dispose();
}
