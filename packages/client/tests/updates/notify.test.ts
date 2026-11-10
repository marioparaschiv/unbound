import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ToastOptions } from '@unbound-app/types/toasts';

import type { PendingUpdate } from '~/updates/addon-updates';
import type { UpdatesState } from '~/updates/state';

import { coreI18nMock } from '../helpers/core-i18n';

Reflect.set(globalThis, '$$DEV$$', false);

const toasts: ToastOptions[] = [];

mock.module('~/i18n/api', coreI18nMock);

const actualToasts = await import('~/toasts/api');

mock.module('~/toasts/api', () => ({
	...actualToasts,
	show: (toast: ToastOptions) => {
		toasts.push(toast);

		return { update() {}, close() {} };
	},
}));

const { notifyClientUpdated, notifyUpdates } = await import('~/updates/notify');

const QUIET = { loader: false, addons: false };
const LOUD = { loader: true, addons: true };

function pending(id: string): PendingUpdate {
	return {
		kind: 'plugin',
		id,
		name: id,
		from: '1.0.0',
		update: {
			id,
			version: '1.1.0',
			reason: 'newer',
			manifestUrl: `https://cdn.example/${id}/manifest.json`,
			bundleUrl: `https://cdn.example/${id}/index.js`,
			sha256: '0'.repeat(64),
			changelog: null,
			changes: null,
			changelogs: [],
		},
	};
}

function ready(requiredLoader: string | null, updates = 0): UpdatesState {
	return {
		status: 'ready',
		checkedAt: new Date().toISOString(),
		updates: Array.from({ length: updates }, (_, index) => pending(`dev.addon${index}`)),
		loader: null,
		requiredLoader,
		discord: null,
	};
}

beforeEach(() => {
	toasts.length = 0;
});

describe('notifyUpdates', () => {
	test('warns that the loader is too old even with notifications off', () => {
		notifyUpdates(ready('2.0.0', 3), QUIET);

		expect(toasts).toHaveLength(1);
		expect(toasts[0]?.icon).toBe('WarningIcon');
		expect(toasts[0]?.content).toContain('2.0.0');
	});

	test('announces waiting addon updates only with addon notifications on', () => {
		notifyUpdates(ready(null, 2), { loader: true, addons: false });
		expect(toasts).toHaveLength(0);

		notifyUpdates(ready(null, 2), { loader: false, addons: true });
		expect(toasts).toHaveLength(1);
		expect(toasts[0]?.icon).toBe('DownloadIcon');
	});

	test('stays quiet when nothing is waiting or the check did not finish', () => {
		notifyUpdates(ready(null), LOUD);
		notifyUpdates({ status: 'checking' }, LOUD);

		expect(toasts).toHaveLength(0);
	});

	test('leaves a newer loader out with loader notifications off', () => {
		const state = {
			...ready(null),
			loader: {
				platform: 'ios' as const,
				version: '2.0.0',
				url: 'https://example.com/loader',
				changelog: null,
				publishedAt: new Date().toISOString(),
				changelogs: [],
			},
		};

		notifyUpdates(state, { loader: false, addons: true });
		expect(toasts).toHaveLength(0);

		notifyUpdates(state, { loader: true, addons: false });
		expect(toasts).toHaveLength(1);
	});
});

describe('notifyClientUpdated', () => {
	test('announces a new client version, but not the first launch or a relaunch', () => {
		notifyClientUpdated('', '1.1.0');
		notifyClientUpdated('1.1.0', '1.1.0');
		expect(toasts).toHaveLength(0);

		notifyClientUpdated('1.0.0', '1.1.0');
		expect(toasts).toHaveLength(1);
		expect(toasts[0]?.content).toContain('1.1.0');
	});
});
