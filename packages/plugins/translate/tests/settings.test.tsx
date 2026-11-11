import { metro, render } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ComponentType } from 'react';
import { settings } from '@unbound-app/settings';

import { SettingsPanel } from '~/settings';

const sheets: { key: string; load: Promise<{ default: ComponentType<object> }>; props: object }[] =
	[];
const hidden: string[] = [];

beforeEach(() => {
	sheets.length = 0;
	hidden.length = 0;
	metro.register({
		openLazy: (load: Promise<{ default: ComponentType<object> }>, key: string, props: object) =>
			void sheets.push({ key, load, props }),
		hideActionSheet: (key: string) => void hidden.push(key),
	});
});

function rows() {
	return render(<SettingsPanel />).findAll('Row');
}

describe('the settings panel', () => {
	test('offers to connect an account and keeps the languages locked until then', () => {
		const [connect, source, target] = rows();

		expect(connect?.props.label).toBe('Connect Discord account');
		expect(connect?.props.subLabel).toBe('Sign in to enable translation');
		expect([source?.props.disabled, target?.props.disabled]).toEqual([true, true]);
	});

	test('offers to reconnect once signed in, and shows the chosen languages', () => {
		settings.refreshToken = 'refresh';

		const [connect, source, target] = rows();

		expect(connect?.props.label).toBe('Reconnect Discord account');
		expect([source?.props.subLabel, target?.props.subLabel]).toEqual(['auto', 'en']);
		expect([source?.props.disabled, target?.props.disabled]).toEqual([false, false]);
	});

	test('saves the language picked from the sheet and closes it', async () => {
		settings.refreshToken = 'refresh';

		rows()[2]?.props.onPress?.();

		const [{ key, load, props }] = sheets as [(typeof sheets)[number]];
		const Sheet = (await load).default;
		const sheet = render(<Sheet {...props} />);
		const german = sheet.findAll('ActionSheetRow').find((row) => row.props.subLabel === 'de');

		german?.props.onPress?.();

		expect(settings.targetLanguage).toBe('de');
		expect(hidden).toEqual([key]);
	});
});
