import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ToastOptions } from '@unbound-app/types/toasts';

import type { PendingUpdate } from '~/updates/addon-updates';
import type { UpdatesState } from '~/updates/state';

import { coreI18nMock } from './helpers/core-i18n';

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

const { notifyUpdates } = await import('~/updates/notify');

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
		notifyUpdates(ready('2.0.0', 3), false);

		expect(toasts).toHaveLength(1);
		expect(toasts[0]?.icon).toBe('WarningIcon');
		expect(toasts[0]?.content).toContain('2.0.0');
	});

	test('announces waiting updates only with notifications on', () => {
		notifyUpdates(ready(null, 2), false);
		expect(toasts).toHaveLength(0);

		notifyUpdates(ready(null, 2), true);
		expect(toasts).toHaveLength(1);
		expect(toasts[0]?.icon).toBe('DownloadIcon');
	});

	test('stays quiet when nothing is waiting or the check did not finish', () => {
		notifyUpdates(ready(null), true);
		notifyUpdates({ status: 'checking' }, true);

		expect(toasts).toHaveLength(0);
	});
});
