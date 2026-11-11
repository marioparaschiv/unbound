import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

type Subscribe = (listener: () => void) => () => void;

let renders = 0;

// A mounted component: the unsubscribe React calls on unmount.
type Mounted = { unmount: () => void };

let mounts: Mounted[] = [];

// Mounts a component on every call, the way React subscribes on mount; each notification counts as a render.
function useSyncExternalStore<T>(subscribe: Subscribe, getSnapshot: () => T): T {
	mounts.push({ unmount: subscribe(() => void renders++) });

	return getSnapshot();
}

mock.module('react', () => ({
	...React,
	default: { ...React, useSyncExternalStore },
	useSyncExternalStore,
}));

const { createAddonLocales } = await import('~/i18n/addon-locales');
const { countLocaleListeners, setLocale } = await import('~/i18n/locale');

const fallback = { TITLE: 'Welcome back', ONLY_ENGLISH: 'English' };
const tables: Record<string, Record<string, string>> = {
	de: { TITLE: 'Willkommen zurück' },
	fr: { TITLE: 'Bon retour' },
};

let reads: string[];

function source(codes = ['de', 'fr']) {
	return {
		owner: 'locales.example',
		codes,
		read: async (code: string) => {
			reads.push(code);

			return JSON.stringify(tables[code]);
		},
	};
}

const formatWith = (messages: Record<string, string>, key: string) => messages[key];

async function settle() {
	await Bun.sleep(0);
}

beforeEach(() => {
	reads = [];
	renders = 0;
	mounts = [];
	setLocale('en-US');
});

describe('addon locales', () => {
	test('holds only en-US until a string is read in another locale', async () => {
		const locales = createAddonLocales(fallback, source(), formatWith);

		setLocale('de');
		await settle();

		expect(reads).toEqual([]);
		expect(locales.loadedLocales()).toEqual(['en-US']);

		expect(locales.messages.TITLE).toBe('Welcome back');
		await settle();

		expect(reads).toEqual(['de']);
		expect(locales.messages.TITLE).toBe('Willkommen zurück');
		expect(locales.messages.ONLY_ENGLISH).toBe('English');
		expect(locales.messages.MISSING).toBe('MISSING');
		expect(locales.loadedLocales()).toEqual(['en-US', 'de']);
		locales.dispose();
	});

	test('with nothing mounted, the next read in a new locale drops the old table and loads the new one', async () => {
		const locales = createAddonLocales(fallback, source(), formatWith);

		setLocale('de');
		void locales.messages.TITLE;
		await settle();
		setLocale('fr');

		expect(locales.messages.TITLE).toBe('Welcome back');
		expect(locales.loadedLocales()).toEqual(['en-US']);

		await settle();

		expect(reads).toEqual(['de', 'fr']);
		expect(locales.loadedLocales()).toEqual(['en-US', 'fr']);
		expect(locales.messages.TITLE).toBe('Bon retour');
		expect(locales.format('TITLE')).toBe('Bon retour');
		locales.dispose();
	});

	test('never reads a locale the manifest does not list', async () => {
		const locales = createAddonLocales(fallback, source(['de']), formatWith);

		setLocale('ja');

		expect(locales.messages.TITLE).toBe('Welcome back');
		await settle();

		expect(reads).toEqual([]);
		locales.dispose();
	});
});

describe('useMessages', () => {
	test('follows locale changes only while a component is mounted, with one listener for all of them', () => {
		const locales = createAddonLocales(fallback, source(), formatWith);
		const before = countLocaleListeners();

		expect(countLocaleListeners()).toBe(before);

		locales.useMessages();
		locales.useMessages();
		locales.useMessages();

		expect(countLocaleListeners()).toBe(before + 1);

		for (const { unmount } of mounts.splice(0)) unmount();

		expect(countLocaleListeners()).toBe(before);

		locales.useMessages();

		expect(countLocaleListeners()).toBe(before + 1);

		locales.dispose();
	});

	test('dispose removes the listener while components are still mounted', () => {
		const locales = createAddonLocales(fallback, source(), formatWith);
		const before = countLocaleListeners();

		locales.useMessages();
		locales.useMessages();
		locales.dispose();

		expect(countLocaleListeners()).toBe(before);

		// React unmounting afterwards must not unregister anything twice.
		for (const { unmount } of mounts.splice(0)) unmount();

		expect(countLocaleListeners()).toBe(before);
	});

	test('re-renders mounted components when the locale changes and when its table loads', async () => {
		const locales = createAddonLocales(fallback, source(), formatWith);

		locales.useMessages();
		setLocale('de');
		void locales.messages.TITLE;
		await settle();

		// One for the change, one for the loaded table.
		expect(renders).toBe(2);
		locales.dispose();
	});

	test('does not re-render a mounted component without an update', async () => {
		const locales = createAddonLocales(fallback, source(), formatWith);

		locales.useMessages();
		void locales.messages.TITLE;
		setLocale('en-US');
		await settle();

		expect(renders).toBe(0);
		locales.dispose();
	});

	test('returns the active locale code, and the global strings follow it', async () => {
		const locales = createAddonLocales(fallback, source(), formatWith);

		expect(locales.useMessages()).toBe('en-US');

		setLocale('de');

		expect(locales.useMessages()).toBe('de');

		void locales.messages.TITLE;
		await settle();

		expect(locales.format('TITLE')).toBe('Willkommen zurück');
		locales.dispose();
	});
});
