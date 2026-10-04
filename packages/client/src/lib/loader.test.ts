import { expect, test } from 'bun:test';

import deferUntilReady from './loader';

type ReadyState = {
	ready: boolean;
	callbacks: Array<() => void>;
};

type RuntimeWithLoaderHooks = typeof globalThis & {
	__d?: unknown;
	__r?: (id: number) => unknown;
};

test('releases readiness callbacks after Discord startup resumes', async () => {
	const state = (globalThis as typeof globalThis & { __unboundReady?: ReadyState })
		.__unboundReady;
	if (!state) throw new Error('Readiness state was not installed.');

	const events: string[] = [];
	state.ready = false;
	state.callbacks.splice(0);
	state.callbacks.push(() => events.push('ready'));

	const runtime = globalThis as RuntimeWithLoaderHooks;
	const requireDescriptor = Object.getOwnPropertyDescriptor(runtime, '__r');
	const defineDescriptor = Object.getOwnPropertyDescriptor(runtime, '__d');
	delete runtime.__r;
	delete runtime.__d;

	try {
		deferUntilReady(async () => {
			events.push('initialize');
		});

		runtime.__r = (id) => {
			events.push(`discord:${id}`);
		};
		runtime.__r?.(0);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(events).toEqual(['initialize', 'discord:0', 'ready']);
		expect(state.ready).toBe(true);
		expect(state.callbacks).toHaveLength(0);
	} finally {
		delete runtime.__r;
		delete runtime.__d;
		if (requireDescriptor) Object.defineProperty(runtime, '__r', requireDescriptor);
		if (defineDescriptor) Object.defineProperty(runtime, '__d', defineDescriptor);
		state.ready = false;
		state.callbacks.splice(0);
	}
});

test('materializes Metro modules before initializing when require already exists', async () => {
	type RuntimeWithModules = RuntimeWithLoaderHooks & {
		__c?: () => Map<unknown, unknown>;
		modules?: Map<unknown, unknown>;
	};

	const runtime = globalThis as RuntimeWithModules;
	const previousCollector = runtime.__c;
	const previousModules = runtime.modules;
	const previousRequire = runtime.__r;
	const events: string[] = [];

	delete runtime.modules;
	runtime.__c = () => {
		events.push('collect');
		return new Map();
	};
	runtime.__r = () => undefined;

	try {
		deferUntilReady(async () => {
			events.push(runtime.modules ? 'initialize' : 'missing');
		});

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(events).toEqual(['collect', 'initialize']);
	} finally {
		if (previousCollector) runtime.__c = previousCollector;
		else delete runtime.__c;
		if (previousModules) runtime.modules = previousModules;
		else delete runtime.modules;
		if (previousRequire) runtime.__r = previousRequire;
		else delete runtime.__r;
	}
});
