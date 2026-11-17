import { describe, expect, mock, test } from 'bun:test';

const files = new Map<string, string>([['Unbound/Data/breadcrumbs.json', '["last launch"]']]);

mock.module('@unbound-app/logger', () => ({ createLogger: () => ({ warn: () => undefined }) }));
mock.module('~/native/fs', () => ({
	default: {
		exists: async (path: string) => files.has(path),
		readFile: async (path: string) => files.get(path) ?? '',
		writeFile: async (path: string, text: string) => files.set(path, text),
	},
}));

type Action = { type: string };

type Interceptor = (action: Action) => boolean;

const interceptors: Interceptor[] = [];

mock.module('~/flux/modules', () => ({
	Dispatcher: {
		addInterceptor: (interceptor: Interceptor) => interceptors.push(interceptor),
	},
}));
mock.module('~/metro/lookups', () => ({ findByProps: () => undefined }));

const {
	previousBreadcrumbs,
	recentBreadcrumbs,
	recordBreadcrumb,
	startBreadcrumbs,
	stopBreadcrumbs,
} = await import('~/diagnostics/breadcrumbs');

startBreadcrumbs();

describe('breadcrumbs', () => {
	test('keeps the newest thirty as lines, never their data', () => {
		for (let index = 0; index < 35; index++) {
			recordBreadcrumb({ category: 'dispatch', message: `ACTION_${index}` });
		}

		const lines = recentBreadcrumbs();

		expect(lines).toHaveLength(30);
		expect(lines[0]).toEndWith('dispatch: ACTION_5');
		expect(lines.at(-1)).toEndWith('dispatch: ACTION_34');
	});

	test('keeps Flux action types, collapsing repeats, and nothing once stopped', () => {
		interceptors[0]?.({ type: 'PRESENCE_UPDATES' });
		interceptors[0]?.({ type: 'PRESENCE_UPDATES' });
		interceptors[0]?.({ type: 'CHANNEL_SELECT' });

		expect(
			recentBreadcrumbs()
				.slice(-2)
				.map((line) => line.slice(9)),
		).toEqual(['action: PRESENCE_UPDATES ×2', 'action: CHANNEL_SELECT']);

		stopBreadcrumbs();
		interceptors[0]?.({ type: 'LOGOUT' });
		expect(recentBreadcrumbs().at(-1)).toEndWith('action: CHANNEL_SELECT');
		startBreadcrumbs();
		expect(interceptors).toHaveLength(1);
	});

	test('reads the previous launch before this one overwrites it', async () => {
		expect(await previousBreadcrumbs()).toEqual(['last launch']);
	});
});
