import { afterEach, describe, expect, test } from 'bun:test';

const { makeManifest, resetDevice } = await import('../helpers/addons');
const { themes } = await import('~/themes/manager');
const { default: ThemeStore } = await import('~/themes/state');

const MIDNIGHT = JSON.stringify({ type: 'midnight' });
const LIGHT = JSON.stringify({ type: 'light' });

function load(id: string, bundle: string) {
	themes.load(bundle, { ...makeManifest(id), type: 'theme' });

	return themes.getEntity(id);
}

afterEach(async () => {
	for (const theme of themes.getEntities()) {
		await themes.unload(theme);
	}

	resetDevice();
	ThemeStore.getState().setApplied(null, null);
});

describe('applying one theme at a time', () => {
	test('applying a theme stops the one it replaces and shows the new one', () => {
		const first = load('theme.first', MIDNIGHT);
		const second = load('theme.second', LIGHT);

		themes.enable('theme.first');
		themes.enable('theme.second');

		expect(first?.started).toBe(false);
		expect(second?.started).toBe(true);
		expect(themes.isEnabled('theme.first')).toBe(false);
		expect(themes.isEnabled('theme.second')).toBe(true);
		expect(themes.getAppliedId()).toBe('theme.second');
		expect(ThemeStore.getState()).toMatchObject({
			applied: 'theme.second',
			data: { type: 'light' },
		});
	});

	test('turning the applied theme off brings back Discord’s theme', () => {
		const theme = load('theme.off', MIDNIGHT);

		themes.enable('theme.off');
		themes.disable('theme.off');

		expect(theme?.started).toBe(false);
		expect(themes.getAppliedId()).toBeNull();
		expect(ThemeStore.getState()).toMatchObject({ applied: null, data: null });
	});

	test('turning off a theme that is not applied leaves the applied one on screen', () => {
		load('theme.kept', MIDNIGHT);
		load('theme.other', LIGHT);

		themes.enable('theme.kept');
		themes.disable('theme.other');

		expect(themes.getAppliedId()).toBe('theme.kept');
		expect(ThemeStore.getState().applied).toBe('theme.kept');
	});

	test('a theme applied before launch starts and shows as it loads', () => {
		themes.enable(load('theme.earlier', MIDNIGHT)?.id ?? '');
		void themes.unload('theme.earlier');
		ThemeStore.getState().setApplied(null, null);

		const theme = load('theme.earlier', MIDNIGHT);

		expect(theme?.started).toBe(true);
		expect(ThemeStore.getState()).toMatchObject({
			applied: 'theme.earlier',
			data: { type: 'midnight' },
		});
	});

	test('deleting the applied theme takes it off screen', async () => {
		load('theme.deleted', MIDNIGHT);
		themes.enable('theme.deleted');

		await themes.delete('theme.deleted');

		expect(themes.getAppliedId()).toBeNull();
		expect(ThemeStore.getState().applied).toBeNull();
	});
});
