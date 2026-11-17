import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Dialog = {
	title: string;
	body?: string;
	buttons?: { label: string; onPress?: () => void }[];
	onCancel?: () => void;
};

type NameVars = { name: string };

const dialogs: Dialog[] = [];
const settings = new Map<string, boolean>();

mock.module('~/dialogs/api', () => ({ showDialog: (options: Dialog) => dialogs.push(options) }));
mock.module('~/settings/unbound', () => ({
	setSetting: (key: string, value: boolean) => settings.set(key, value),
}));
mock.module('~/i18n/api', () => ({
	messages: new Proxy({}, { get: (_, key) => String(key) }),
	format: (key: string, vars: NameVars) => `${key}:${vars.name}`,
}));

const { askToReportCrash } = await import('~/diagnostics/crash-consent');

beforeEach(() => {
	dialogs.length = 0;
	settings.clear();
});

describe('askToReportCrash', () => {
	test('names the addon, and Always Send turns reporting on', async () => {
		const answer = askToReportCrash('unbound.chat-bubbles');

		expect(dialogs[0]?.body).toBe('UNBOUND_CRASH_REPORT_ASK_ADDON:unbound.chat-bubbles');
		dialogs[0]?.buttons?.[1]?.onPress?.();

		expect(await answer).toBe('always');
		expect(settings.get('crash-reports')).toBe(true);
	});

	test('asks only once per launch', async () => {
		expect(await askToReportCrash()).toBe('declined');
		expect(dialogs).toHaveLength(0);
	});
});
