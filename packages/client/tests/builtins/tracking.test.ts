import { afterEach, describe, expect, mock, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type Filter = { filePath?: string };
type Interceptor = (action: MetroExport) => boolean;

const waiting = new Map<string, (mdl: MetroExport) => void>();
const interceptors = new Map<string, Interceptor>();
const Utils = { track: () => 'sent' };

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ warn: () => undefined, error: () => undefined }),
}));

mock.module('~/flux/api', () => ({
	interceptAction: (type: string, interceptor: Interceptor) => {
		interceptors.set(type, interceptor);

		return () => void interceptors.delete(type);
	},
}));

mock.module('~/metro/wait', () => ({
	onModuleLoaded: (filter: Filter, onLoad: (mdl: MetroExport) => void) => {
		const key = filter.filePath ?? 'props';

		waiting.set(key, onLoad);

		return () => void waiting.delete(key);
	},
}));

mockLookups({
	findByProps: (...props: string[]) => (props.includes('track') ? Utils : undefined),
});

const { ANALYTICS_MANAGERS, start, stop } = await import('~/builtins/tracking');

function createManager(initialized = false) {
	const calls: string[] = [];

	return {
		calls,
		isInitialized: initialized,
		initialize: () => void calls.push('initialize'),
		terminate: () => void calls.push('terminate'),
	};
}

afterEach(() => {
	stop();
});

describe('tracking', () => {
	test('drops TRACK actions after settling the promise their caller awaits', () => {
		start();

		let settled = false;
		const dropped = interceptors.get('TRACK')?.({
			type: 'TRACK',
			resolve: () => void (settled = true),
		});

		expect(dropped).toBe(true);
		expect(settled).toBe(true);
	});

	test('answers track with a resolved promise, so callers can chain on it', async () => {
		start();

		const result: unknown = Utils.track();

		expect(result).toBeInstanceOf(Promise);
		expect(await result).toBeUndefined();

		stop();
		expect(Utils.track()).toBe('sent');
	});

	test('keeps each analytics manager from starting', () => {
		start();

		expect(ANALYTICS_MANAGERS.every((path) => waiting.has(path))).toBe(true);

		const manager = createManager();

		waiting.get(ANALYTICS_MANAGERS[0])?.({ default: manager });
		manager.initialize();

		expect(manager.calls).toEqual([]);
	});

	test('stops a manager Discord already started', () => {
		start();

		const manager = createManager(true);

		waiting.get(ANALYTICS_MANAGERS[1])?.({ default: manager });

		expect(manager.calls).toEqual(['terminate']);
	});

	test('stops waiting for managers and removes the interceptor when stopped', () => {
		start();
		stop();

		expect(waiting.size).toBe(0);
		expect(interceptors.size).toBe(0);
	});
});
