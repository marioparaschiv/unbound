import { beforeEach, describe, expect, mock, test } from 'bun:test';

const settings = new Map<string, string | number | boolean>();
const sent: unknown[] = [];
const toasts: unknown[][] = [];
let answer: (count: number) => object = (count) => ({ id: `report-${count}` });
let consent: 'once' | 'always' | 'declined' = 'declined';
const asked: (string | undefined)[] = [];

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ warn: () => undefined, error: () => undefined }),
}));
mock.module('~/settings/unbound', () => ({
	getSetting: (key: string) => settings.get(key) ?? (key === 'crash-reports.lastId' ? '' : 0),
	setSetting: (key: string, value: string | number | boolean) => settings.set(key, value),
}));
mock.module('~/native/unbound-native', () => ({ getLoader: () => undefined }));
mock.module('~/native/fs', () => ({ default: { exists: async () => false } }));
mock.module('~/core/environment', () => ({
	currentEnvironment: () => ({
		platform: 'ios',
		clientVersion: '3.0.0',
		loaderVersion: '1.4.0',
		discordVersion: '353.0',
		osVersion: '26.0.1',
		deviceModel: 'iPhone12,8',
	}),
}));
mock.module('~/account/client', () => ({
	createUnboundClient:
		() =>
		async (_route: string, { body }: { body: unknown }) => {
			sent.push(body);

			return answer(sent.length);
		},
}));

mock.module('~/diagnostics/crash-consent', () => ({
	askToReportCrash: async (subject?: string) => {
		asked.push(subject);

		return consent;
	},
}));
mock.module('~/toasts/api', () => ({ info: (...args: unknown[]) => toasts.push(args) }));

const { reportNativeCrash } = await import('~/diagnostics/crash-reports');

const launch = {
	bundle: 'active' as const,
	earlyCloses: 0,
	recovery: false,
	previousExit: 'crashed' as const,
	lastCrash: 'SIGSEGV in Chat Bubbles',
	crashStack: 'Signal 11\n#0 0x1 Unbound.dylib + 0x10',
	crashes: [{ at: 1_000, crash: 'SIGSEGV in Chat Bubbles' }],
};

describe('reportNativeCrash', () => {
	beforeEach(() => {
		settings.clear();
		sent.length = 0;
		toasts.length = 0;
		answer = (count) => ({ id: `report-${count}` });
		consent = 'declined';
		asked.length = 0;
	});

	test('asks while crash reporting is off, and never again about a declined crash', async () => {
		await reportNativeCrash(launch);
		await reportNativeCrash(launch);

		expect(asked).toEqual([undefined]);
		expect(sent).toHaveLength(0);
	});

	test('sends once the user agrees', async () => {
		consent = 'once';

		await reportNativeCrash(launch);

		expect(sent).toHaveLength(1);
		expect(settings.get('crash-reports.lastId')).toBe('report-1');
	});

	test('does not ask when crash reporting is on', async () => {
		settings.set('crash-reports', true);

		await reportNativeCrash(launch);

		expect(asked).toEqual([]);
		expect(sent).toHaveLength(1);
	});

	test('sends the stack once and keeps the report id for /debug', async () => {
		settings.set('crash-reports', true);

		await reportNativeCrash(launch);
		await reportNativeCrash(launch);

		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			kind: 'native-crash',
			message: 'SIGSEGV in Chat Bubbles',
			stack: launch.crashStack,
		});
		expect(settings.get('crash-reports.lastId')).toBe('report-1');

		await reportNativeCrash({
			...launch,
			crashes: [...launch.crashes, { at: 2_000, crash: 'SIGABRT' }],
		});

		expect(sent).toHaveLength(2);
	});

	test('tries again next launch when sending failed', async () => {
		settings.set('crash-reports', true);
		answer = () => {
			throw new Error('offline');
		};

		await reportNativeCrash(launch);

		answer = (count) => ({ id: `report-${count}` });
		await reportNativeCrash(launch);

		expect(sent).toHaveLength(2);
		expect(settings.get('crash-reports.lastId')).toBe('report-2');
	});

	test('tells the user which issue tracks the crash', async () => {
		settings.set('crash-reports', true);
		answer = (count) => ({
			id: `report-${count}`,
			issue: { number: 77, url: 'u', created: false },
		});

		await reportNativeCrash(launch);

		expect(toasts).toEqual([['UNBOUND_CRASH_REPORT_JOINED', { number: 77 }]]);
	});
});
