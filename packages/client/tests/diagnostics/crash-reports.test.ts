import { beforeEach, describe, expect, mock, test } from 'bun:test';

const settings = new Map<string, string | number | boolean>();
const sent: unknown[] = [];
const routes: { route: string; params?: Record<string, string> }[] = [];
const toasts: unknown[][] = [];
let answer: (count: number) => object = (count) => ({ id: `report-${count}` });
let issueAnswer: () => object = () => ({
	origin: 'system',
	issue: { number: 9, url: 'https://github.com/o/r/issues/9', created: true },
});
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
const files = new Map<string, string>();

mock.module('~/native/fs', () => ({
	default: {
		exists: async (path: string) => files.has(path),
		readFile: async (path: string) => files.get(path) ?? '',
		writeFile: async (path: string, contents: string) => void files.set(path, contents),
	},
}));
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
		async (
			route: string,
			{ body, params }: { body?: unknown; params?: Record<string, string> },
		) => {
			routes.push({ route, ...(params ? { params } : {}) });

			if (route.endsWith('/issue')) {
				return issueAnswer();
			}

			sent.push(body);

			return answer(sent.length);
		},
}));

mock.module('~/diagnostics/crash-context', () => ({
	crashContext: async (breadcrumbs: string[]) => ({ breadcrumbs }),
}));
mock.module('~/diagnostics/breadcrumbs', () => ({
	recentBreadcrumbs: () => ['now'],
	previousBreadcrumbs: async () => ['before the crash'],
}));
mock.module('~/diagnostics/crash-consent', () => ({
	askToReportCrash: async (subject?: string) => {
		asked.push(subject);

		return consent;
	},
}));
mock.module('~/toasts/api', () => ({ info: (...args: unknown[]) => toasts.push(args) }));
mock.module('~/plugins/manager', () => ({
	plugins: {
		getAddon: (id: string) =>
			id === 'unbound.chat-bubbles'
				? { id, version: '1.6.28', manifest: { trust: 'signed' } }
				: undefined,
	},
}));

const { fileRecordedCrash, reportCrash, reportNativeCrash, reportSystemHang, retryPendingIssues } =
	await import('~/diagnostics/crash-reports');

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
		expect(sent[0]).toMatchObject({ context: { breadcrumbs: ['before the crash'] } });
		expect((sent[0] as { installId: string }).installId).toMatch(/^[0-9a-f]{32}$/);
		expect(settings.get('crash-reports.installId')).toBe(
			(sent[0] as { installId: string }).installId,
		);
	});

	test('keeps a background watchdog kill out of reports', async () => {
		settings.set('crash-reports', true);

		await reportNativeCrash({
			...launch,
			crashStack:
				'Signal 9\nException 10 code 0\nTermination <RBSTerminateContext| domain:10 code:0x8BADF00D>\nWatchdogVisibility: Background',
		});

		expect(sent).toHaveLength(0);
		expect(settings.get('crash-reports.nativeAt')).toBe(1_000);
	});

	test('keeps a watchdog kill while quitting out of reports', async () => {
		settings.set('crash-reports', true);

		await reportNativeCrash({
			...launch,
			crashStack:
				'Signal 9\nException 10 code 0\nTermination <RBSTerminateContext| domain:10 code:0x8BADF00D explanation:Failed to terminate gracefully after 5.0s\nWatchdogEvent: process-exit\nWatchdogVisibility: Foreground',
		});

		expect(sent).toHaveLength(0);
	});

	test('keeps a VoIP push kill out of reports', async () => {
		settings.set('crash-reports', true);

		await reportNativeCrash({
			...launch,
			crashStack:
				'Signal 9\nException 10 code 0\nTermination <RBSTerminateContext| domain:10 code:0xBAADCA11 explanation:<no explanation given>>',
		});

		expect(sent).toHaveLength(0);
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

	test('says the report was sent when its issue is not open yet', async () => {
		settings.set('crash-reports', true);
		answer = (count) => ({ id: `report-${count}`, origin: 'discord', unfiled: 'failed' });

		await reportNativeCrash(launch);

		expect(toasts).toEqual([['UNBOUND_CRASH_REPORT_SENT']]);
	});

	test("never calls one of Unbound's own plugins third-party", async () => {
		settings.set('crash-reports', true);
		answer = (count) => ({ id: `report-${count}`, origin: 'addon', unfiled: 'unavailable' });

		await reportNativeCrash({
			...launch,
			crashStack: `${launch.crashStack}\nAddon {"id":"unbound.chat-bubbles"}`,
		});

		expect(toasts).toEqual([['UNBOUND_CRASH_REPORT_SENT']]);
	});
});

describe('fileRecordedCrash', () => {
	beforeEach(() => {
		sent.length = 0;
		routes.length = 0;
		answer = (count) => ({ id: `report-${count}` });
	});

	test('sends a crash that was never reported, then asks the server for its issue', async () => {
		const filed = await fileRecordedCrash({ at: 5, kind: 'native-crash', message: 'SIGSEGV' });

		expect(sent).toHaveLength(1);
		expect(routes.at(-1)).toEqual({
			route: 'POST /api/v1/crash-reports/$id/issue',
			params: { id: 'report-1' },
		});
		expect(filed).toEqual({
			origin: 'system',
			issue: { number: 9, url: 'https://github.com/o/r/issues/9' },
		});
	});

	test('uses the issue the report itself was filed under', async () => {
		answer = () => ({
			id: 'report-x',
			origin: 'unbound',
			issue: { number: 4, url: 'https://github.com/o/r/issues/4', created: false },
		});

		const filed = await fileRecordedCrash({ at: 6, kind: 'crash', message: 'TypeError' });

		expect(routes).toHaveLength(1);
		expect(filed?.issue?.number).toBe(4);
	});

	test('files an already sent report without sending it again', async () => {
		await fileRecordedCrash({ at: 7, kind: 'freeze', message: 'x', reportId: 'stored' });

		expect(sent).toHaveLength(0);
		expect(routes).toEqual([
			{ route: 'POST /api/v1/crash-reports/$id/issue', params: { id: 'stored' } },
		]);
	});

	test('reports a third-party crash without an issue', async () => {
		issueAnswer = () => ({ origin: 'addon', unfiled: 'third-party' });

		const filed = await fileRecordedCrash({
			at: 8,
			kind: 'crash',
			message: 'x',
			reportId: 'r',
		});

		expect(filed).toEqual({ origin: 'addon', unfiled: 'third-party' });
	});
});

describe('reportSystemHang', () => {
	beforeEach(() => {
		settings.clear();
		sent.length = 0;
		answer = (count) => ({ id: `report-${count}` });
		consent = 'once';
	});

	const hangLaunch = {
		...launch,
		system: {
			lastHang: {
				at: 5_000,
				ms: 4_000,
				stack: 'Hang 4 sec\n#0 0x1000 Unbound.dylib + 0x10\n',
			},
		},
	};

	test('reports the newest hang once, as a freeze with its stack', async () => {
		await reportSystemHang(hangLaunch);
		await reportSystemHang(hangLaunch);

		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			kind: 'freeze',
			phase: 'frozen',
			seconds: 4,
			message: 'Hang 4 sec',
			stack: hangLaunch.system.lastHang.stack,
		});
		expect(settings.get('crash-reports.hangAt')).toBe(5_000);
	});

	test('blames the plugin that froze during the hang', async () => {
		await reportSystemHang({
			...launch,
			system: {
				lastHang: {
					...hangLaunch.system.lastHang,
					at: 6_000,
					addon: 'Chat Bubbles',
					addonId: 'unbound.chat-bubbles',
				},
			},
		});

		expect(sent[0]).toMatchObject({
			kind: 'freeze',
			addon: { id: 'unbound.chat-bubbles', version: '1.6.28', trust: 'signed' },
		});
	});

	test('does nothing without a hang', async () => {
		await reportSystemHang(launch);

		expect(sent).toHaveLength(0);
	});
});

describe('retryPendingIssues', () => {
	beforeEach(() => {
		files.clear();
		sent.length = 0;
		routes.length = 0;
		settings.clear();
		settings.set('crash-reports', true);
	});

	test('files a report again on a later launch when GitHub could not open its issue', async () => {
		answer = () => ({ id: 'stored', origin: 'unbound' });

		await reportCrash({ kind: 'crash', message: 'TypeError: boom' });

		const { readCrashHistory } = await import('~/diagnostics/crash-history');

		expect((await readCrashHistory()).at(-1)).toMatchObject({
			reportId: 'stored',
			issuePending: true,
		});

		issueAnswer = () => ({
			origin: 'unbound',
			issue: { number: 12, url: 'https://github.com/o/r/issues/12', created: true },
		});
		await retryPendingIssues();

		expect(routes.at(-1)).toEqual({
			route: 'POST /api/v1/crash-reports/$id/issue',
			params: { id: 'stored' },
		});
		expect((await readCrashHistory()).at(-1)).toMatchObject({
			issue: { number: 12 },
			issuePending: false,
		});
	});
});
