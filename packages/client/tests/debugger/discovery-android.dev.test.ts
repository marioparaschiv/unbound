import type {
	NativeJavaArgument,
	NativeJavaHandleValue,
	NativeJavaProxyCall,
	NativeJavaReference,
	NativeJavaValue,
	NativeSerializable,
	NativeUIScope,
} from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { browseAndroid, describeService, type DiscoveryUI } from '~/debugger/discovery-android.dev';
import type { DiscoveryJava, DiscoveryScope } from '~/debugger/discovery-android-worklets.dev';
import type { DiscoveredBridge } from '~/debugger/bridge-service.dev';

type Fake = Record<string, (...args: NativeJavaArgument[]) => NativeJavaValue>;
type Listener = (call: NativeJavaProxyCall) => void;

const NULL: NativeJavaValue = { type: 'null' };
const str = (value: string): NativeJavaValue => ({ type: 'string', value });
const int = (value: number): NativeJavaValue => ({ type: 'int', value });

function idOf(value: NativeJavaArgument | NativeJavaReference | undefined): string {
	return value && 'value' in value && typeof value.value === 'string' ? value.value : '';
}

function textOf(value: NativeJavaArgument | undefined): string {
	return value && 'type' in value && value.type === 'string' ? value.value : '';
}

function numberOf(value: NativeJavaArgument | undefined): number {
	return value && 'value' in value && typeof value.value === 'number' ? value.value : 0;
}

function createAndroid({ application = true } = {}) {
	const objects = new Map<string, Fake>();
	const listeners = new Map<string, Listener>();
	const resolves: string[] = [];
	const calls: string[] = [];
	let disposed = 0;

	function add(fake: Fake): NativeJavaHandleValue {
		const value = `java-${objects.size + 1}`;

		objects.set(value, fake);

		return { type: 'handle', value };
	}

	function call(
		target: NativeJavaArgument | NativeJavaReference | undefined,
		method: string,
		args: NativeJavaArgument[] = [],
	): NativeJavaValue {
		const fake = objects.get(idOf(target))?.[method];

		if (!fake) {
			throw new Error(`No fake ${method} on ${idOf(target)}`);
		}

		return fake(...args);
	}

	const nsd = add({
		discoverServices: (type) => {
			calls.push(`discover ${textOf(type)}`);

			return NULL;
		},
		resolveService: (info) => {
			resolves.push(textOf(call(info, 'getServiceName')));

			return NULL;
		},
		stopServiceDiscovery: () => {
			calls.push('stop');

			return NULL;
		},
	});
	const app = add({ getSystemService: () => nsd });
	const tracker = add({ application: () => (application ? app : NULL) });

	const java: DiscoveryJava = {
		getClass: () => add({}),
		getField: () => tracker,
		invoke: call,
		construct: (className, args = []) => {
			const [source] = args;

			if (className !== 'java.lang.String') {
				return { type: 'handle', value: idOf(source) };
			}

			const text = textOf(call(source, 'bytes'));

			return add({ toString: () => str(text) });
		},
	};
	const scope: DiscoveryScope = {
		java,
		hooks: {
			proxy: (interfaces, handler) => {
				listeners.set(interfaces[0] ?? '', handler);

				return { object: add({}) };
			},
		},
		dispose: () => disposed++,
	};
	const ui: DiscoveryUI = {
		// The browse only reaches the scope through `DiscoveryScope`, which this fake fills.
		createScope: () => scope as NativeUIScope,
		callback<A extends NativeSerializable[]>(listener: (...args: A) => void) {
			return listener;
		},
		run(worklet, ...args) {
			worklet(...args);
		},
	};

	function service(computer: string, hosts: string[], txt: Record<string, string>) {
		const map: Fake = {
			get: (key) => {
				const value = txt[textOf(key)];

				return value === undefined ? NULL : add({ bytes: () => str(value) });
			},
		};
		const addresses = hosts.map((host) => add({ getHostAddress: () => str(host) }));
		const list = add({
			size: () => int(addresses.length),
			get: (index) => addresses[numberOf(index)] ?? NULL,
		});

		return add({
			getServiceName: () => str(computer),
			getServiceType: () => str('._unbound-bridge._tcp.'),
			getPort: () => int(5173),
			getAttributes: () => add(map),
			getHostAddresses: () => list,
		});
	}

	const emit = (listener: string, method: string, ...args: NativeJavaValue[]) =>
		listeners.get(`android.net.nsd.NsdManager$${listener}`)?.({ method, args });

	return { ui, service, emit, resolves, calls, disposed: () => disposed };
}

const TXT = { proto: '1', by: 'cli', code: '4827' };

function browse(android: ReturnType<typeof createAndroid>) {
	const found: DiscoveredBridge[] = [];
	const lost: string[] = [];
	const stop = browseAndroid(android.ui, {
		found: (bridge) => found.push(bridge),
		lost: (computer) => lost.push(computer),
	});

	return { found, lost, stop };
}

describe('describeService', () => {
	test('dials a routable IPv4 address over a link-local one', () => {
		expect(
			describeService({
				computer: 'Mac',
				hosts: ['fe80::1%wlan0', '169.254.3.4', '192.168.1.20'],
				port: 5173,
				txt: TXT,
			}),
		).toEqual({ computer: 'Mac', address: '192.168.1.20:5173', by: 'cli', code: '4827' });
	});

	test('skips services with no IPv4 address or another protocol', () => {
		expect(
			describeService({ computer: 'Mac', hosts: ['fe80::1'], port: 1, txt: TXT }),
		).toBeUndefined();
		expect(
			describeService({
				computer: 'Mac',
				hosts: ['10.0.0.2'],
				port: 1,
				txt: { ...TXT, proto: '2' },
			}),
		).toBeUndefined();
	});
});

describe('browseAndroid', () => {
	test('resolves found services one at a time and reports bridges', () => {
		const android = createAndroid();
		const { found } = browse(android);
		const first = android.service('Mac', ['10.0.0.2'], TXT);
		const second = android.service('Linux', ['10.0.0.3'], { ...TXT, by: 'devtools' });

		expect(android.calls).toEqual(['discover _unbound-bridge._tcp']);

		android.emit('DiscoveryListener', 'onServiceFound', first);
		android.emit('DiscoveryListener', 'onServiceFound', second);
		expect(android.resolves).toEqual(['Mac']);

		android.emit('ResolveListener', 'onServiceResolved', first);
		expect(android.resolves).toEqual(['Mac', 'Linux']);

		android.emit('ResolveListener', 'onResolveFailed', second, int(3));
		expect(found).toEqual([
			{ computer: 'Mac', address: '10.0.0.2:5173', by: 'cli', code: '4827' },
		]);
	});

	test('drops a queued service that goes away and reports it lost', () => {
		const android = createAndroid();
		const { lost } = browse(android);
		const first = android.service('Mac', ['10.0.0.2'], TXT);
		const second = android.service('Linux', ['10.0.0.3'], TXT);

		android.emit('DiscoveryListener', 'onServiceFound', first);
		android.emit('DiscoveryListener', 'onServiceFound', second);
		android.emit('DiscoveryListener', 'onServiceLost', second);
		android.emit('ResolveListener', 'onServiceResolved', first);

		expect(android.resolves).toEqual(['Mac']);
		expect(lost).toEqual(['Linux']);
	});

	test('stops discovery, disposes its scope and ignores later calls', () => {
		const android = createAndroid();
		const { found, stop } = browse(android);
		const first = android.service('Mac', ['10.0.0.2'], TXT);

		stop();
		stop();
		android.emit('DiscoveryListener', 'onServiceFound', first);

		expect(android.calls).toEqual(['discover _unbound-bridge._tcp', 'stop']);
		expect(android.disposed()).toBe(1);
		expect(android.resolves).toEqual([]);
		expect(found).toEqual([]);
	});

	test('disposes its scope when NsdManager is unavailable', () => {
		const android = createAndroid({ application: false });

		browse(android).stop();

		expect(android.calls).toEqual([]);
		expect(android.disposed()).toBe(1);
	});
});
