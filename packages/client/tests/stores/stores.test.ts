import type { InternalToastOptions, SettingsEntry, Theme } from '@unbound-app/types';
import { describe, expect, test, beforeEach } from 'bun:test';

import SettingsStore from '~/stores/settings';
import ThemeStore from '~/stores/themes';
import ToastStore from '~/stores/toasts';

import { resetStore } from '../helpers/store-fixture';

const resetToasts = resetStore(ToastStore);
const resetSettings = resetStore(SettingsStore);
const resetThemes = resetStore(ThemeStore);

function makeToast(
	id: string,
	overrides: Partial<InternalToastOptions> = {},
): InternalToastOptions {
	return { id, content: `content:${id}`, ...overrides };
}

function makeEntry(key: string, title: string): SettingsEntry {
	return {
		type: 'route',
		key,
		useTitle: () => title,
		parent: null,
		screen: { route: `route:${key}`, getComponent: () => () => null },
	};
}

function makeTheme(type: Theme['type']): Theme {
	return {
		semantic: { BACKGROUND_PRIMARY: { type: 'color', value: '#000000' } },
		raw: { PRIMARY_500: '#111111' },
		type,
	};
}

beforeEach(() => {
	resetToasts();
	resetSettings();
	resetThemes();
});

describe('ToastStore.addToast', () => {
	test('a supplied date survives untouched', () => {
		ToastStore.getState().addToast(makeToast('a', { date: 1234 }));

		expect(ToastStore.getState().toasts['a'].date).toBe(1234);
	});

	test('an absent date is stamped with the current time', () => {
		const before = Date.now();
		ToastStore.getState().addToast(makeToast('b'));
		const after = Date.now();

		const { date } = ToastStore.getState().toasts['b'];
		expect(date).toBeGreaterThanOrEqual(before);
		expect(date).toBeLessThanOrEqual(after);
	});

	test('the returned handle merges an update into the stored toast', () => {
		const handle = ToastStore.getState().addToast(
			makeToast('c', { title: 'original', date: 500 }),
		);

		handle.update({ content: 'updated' });

		expect(ToastStore.getState().toasts['c']).toEqual({
			id: 'c',
			title: 'original',
			content: 'updated',
			date: 500,
		});
	});

	test('the returned handle marks the toast closing', () => {
		const handle = ToastStore.getState().addToast(makeToast('d'));

		handle.close();

		expect(ToastStore.getState().toasts['d'].closing).toBe(true);
	});

	test('re-adding an id replaces the previous toast rather than merging it', () => {
		ToastStore.getState().addToast(makeToast('e', { title: 'first', date: 1 }));
		ToastStore.getState().addToast(makeToast('e', { date: 2 }));

		const stored = ToastStore.getState().toasts['e'];
		expect(stored.date).toBe(2);
		expect(stored.title).toBeUndefined();
	});

	test('distinct ids coexist and each add produces a fresh toasts map', () => {
		ToastStore.getState().addToast(makeToast('f'));
		const afterFirst = ToastStore.getState().toasts;

		ToastStore.getState().addToast(makeToast('g'));
		const afterSecond = ToastStore.getState().toasts;

		expect(Object.keys(afterSecond)).toEqual(['f', 'g']);
		expect(afterSecond).not.toBe(afterFirst);
		expect(afterFirst['g']).toBeUndefined();
	});
});

describe('ToastStore.updateToastWithOptions', () => {
	test('an unknown id leaves state untouched by identity', () => {
		ToastStore.getState().addToast(makeToast('h'));
		const before = ToastStore.getState().toasts;

		ToastStore.getState().updateToastWithOptions('missing', { content: 'ignored' });

		expect(ToastStore.getState().toasts).toBe(before);
		expect(ToastStore.getState().toasts['missing']).toBeUndefined();
	});

	test('a known id merges options over the existing toast', () => {
		ToastStore.getState().addToast(makeToast('i', { title: 'keep', date: 7 }));

		ToastStore.getState().updateToastWithOptions('i', { closing: true });

		expect(ToastStore.getState().toasts['i']).toEqual({
			id: 'i',
			title: 'keep',
			content: 'content:i',
			date: 7,
			closing: true,
		});
	});
});

describe('SettingsStore', () => {
	test('registerSection adds an entry under its key', () => {
		const entry = makeEntry('unbound', 'Unbound');

		SettingsStore.getState().registerSection(entry);

		expect(SettingsStore.getState().sections).toEqual({ unbound: entry });
	});

	test('registerSection replaces an entry sharing a key', () => {
		SettingsStore.getState().registerSection(makeEntry('plugins', 'Plugins'));
		const replacement = makeEntry('plugins', 'Addons');

		SettingsStore.getState().registerSection(replacement);

		expect(Object.keys(SettingsStore.getState().sections)).toEqual(['plugins']);
		expect(SettingsStore.getState().sections['plugins']).toBe(replacement);
	});

	test('removeSection drops only the named key', () => {
		SettingsStore.getState().registerSection(makeEntry('themes', 'Themes'));
		SettingsStore.getState().registerSection(makeEntry('plugins', 'Plugins'));

		SettingsStore.getState().removeSection('themes');

		expect(Object.keys(SettingsStore.getState().sections)).toEqual(['plugins']);
	});

	test('removeSection copies the map even when the key is absent', () => {
		SettingsStore.getState().registerSection(makeEntry('themes', 'Themes'));
		const before = SettingsStore.getState().sections;

		SettingsStore.getState().removeSection('never-registered');

		expect(SettingsStore.getState().sections).not.toBe(before);
		expect(SettingsStore.getState().sections).toEqual(before);
	});
});

describe('ThemeStore.setApplied', () => {
	test('applying a theme stores its id alongside its data', () => {
		const theme = makeTheme('midnight');

		ThemeStore.getState().setApplied('dark-theme', theme);

		expect(ThemeStore.getState().applied).toBe('dark-theme');
		expect(ThemeStore.getState().data).toBe(theme);
	});

	test('clearing with nulls unapplies both fields', () => {
		ThemeStore.getState().setApplied('light-theme', makeTheme('light'));

		ThemeStore.getState().setApplied(null, null);

		expect(ThemeStore.getState().applied).toBeNull();
		expect(ThemeStore.getState().data).toBeNull();
	});
});
