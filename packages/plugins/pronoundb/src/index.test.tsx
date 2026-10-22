import { afterEach, expect, mock, test } from 'bun:test';

let afterHandler: ((context: any) => void) | null = null;
let changeCount = 0;
let dispatcherLookupCount = 0;
let requestCount = 0;
let profilePronouns: string | null = null;

mock.module('@unbound-app/api', () => ({
	metro: {
		common: { ReactNative: { Dimensions: { get: () => ({ width: 375 }) } } },
		findStore: (name: string) =>
			name === 'Message'
				? { emitChange: () => changeCount++ }
				: { getUserProfile: () => ({ pronouns: profilePronouns }) },
		findByProps: (...props: string[]) => {
			if (props.includes('getCurrentUser')) return { getCurrentUser: () => ({ id: 'self' }) };
			if (props.includes('getChannel')) return { getChannel: () => ({ guild_id: 'guild' }) };
			if (props.includes('dispatch')) dispatcherLookupCount++;
			if (props.includes('generateMessageRowData'))
				return { generateMessageRowData: () => null };
			return null;
		},
	},
	patcher: {
		after: (_target: unknown, _name: string, handler: (context: any) => void) => {
			afterHandler = handler;
			return () => {};
		},
	},
	storage: { getStore: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
}));

mock.module('@shared/settings-ui', () => ({
	SettingsRow: () => null,
	SettingsScrollView: () => null,
	SettingsSection: () => null,
	SettingsSwitchRow: () => null,
}));

const { default: plugin } = await import('@pronoundb/index');
const originalFetch = globalThis.fetch;

afterEach(() => {
	plugin.stop();
	globalThis.fetch = originalFetch;
	afterHandler = null;
	changeCount = 0;
	dispatcherLookupCount = 0;
	requestCount = 0;
	profilePronouns = null;
});

test('leaves poll result rows untouched and does not queue a profile lookup', async () => {
	globalThis.fetch = async () => {
		requestCount++;
		return new Response(JSON.stringify({}), { status: 200 });
	};
	plugin.start();
	const row = { timestamp: '21:02', timestampAccessibilityLabel: '21:02' };
	afterHandler?.({
		args: [{ message: { type: 46, author: { id: 'self' }, channel_id: 'channel' } }],
		result: { message: row },
	});
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
	expect(row.timestamp).toBe('21:02');
	expect(row.timestampAccessibilityLabel).toBe('21:02');
	expect(requestCount).toBe(0);
	expect(changeCount).toBe(0);
});

test('refreshes normal rows through the store without synthetic message updates', async () => {
	globalThis.fetch = async () => {
		requestCount++;
		return new Response(JSON.stringify({ self: { sets: { en: ['he'] } } }), { status: 200 });
	};
	plugin.start();
	const row = { timestamp: '21:02' };
	const context = {
		args: [{ message: { type: 0, author: { id: 'self' }, channel_id: 'channel' } }],
		result: { message: row },
	};
	afterHandler?.(context);
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
	afterHandler?.(context);
	expect(row.timestamp).toBe('21:02 • he/him');
	expect(requestCount).toBe(1);
	expect(changeCount).toBe(1);
	expect(dispatcherLookupCount).toBe(0);
});

test('keeps a crowded native header legible while preserving accessible pronouns', () => {
	profilePronouns = 'he/him | ISTP | integration engineer';
	plugin.start();
	const row = {
		username: 'adrián (@dylib.dev)',
		tagText: 'Owner',
		roleIcon: { name: 'Server Owner' },
		timestamp: '10/5/26, 19:05',
		timestampAccessibilityLabel: 'October 5, 2026 at 19:05',
	};
	afterHandler?.({
		args: [{ message: { type: 0, author: { id: 'self' }, channel_id: 'channel' } }],
		result: { message: row },
	});
	expect(row.timestamp).toBe('10/5/26, 19:05');
	expect(row.timestampAccessibilityLabel).toBe(
		'October 5, 2026 at 19:05 • he/him | ISTP | integration engineer',
	);
});

test('shows a concise label when the native header has room', () => {
	profilePronouns = 'he/him | ISTP | integration engineer';
	plugin.start();
	const row = {
		username: 'adrián',
		timestamp: '10/5/26, 19:05',
		timestampAccessibilityLabel: 'October 5, 2026 at 19:05',
	};
	afterHandler?.({
		args: [{ message: { type: 0, author: { id: 'self' }, channel_id: 'channel' } }],
		result: { message: row },
	});
	expect(row.timestamp).toBe('10/5/26, 19:05 • he/him');
	expect(row.timestampAccessibilityLabel).toBe(
		'October 5, 2026 at 19:05 • he/him | ISTP | integration engineer',
	);
});

test('reserves space for a possible later username expansion', () => {
	profilePronouns = 'he/him';
	plugin.start();
	const row = {
		username: 'adrián',
		tagText: 'Owner',
		roleIcon: { name: 'Server Owner' },
		timestamp: '10/5/26, 19:05',
		timestampAccessibilityLabel: 'October 5, 2026 at 19:05',
	};
	afterHandler?.({
		args: [
			{
				message: {
					type: 0,
					author: { id: 'self', username: 'dylib.dev' },
					channel_id: 'channel',
				},
			},
		],
		result: { message: row },
	});
	expect(row.timestamp).toBe('10/5/26, 19:05');
	expect(row.timestampAccessibilityLabel).toBe('October 5, 2026 at 19:05 • he/him');
});
