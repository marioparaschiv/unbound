import type { ToastHandle, ToastOptions } from '@unbound-app/types/toasts';
import { beforeEach, describe, expect, test } from 'bun:test';

import { hasPlaceholders, type LooseMessageVars, type MessageLookup } from '~/i18n/message';
import { createFeedbackToasts } from '~/toasts/feedback';

const shown: ToastOptions[] = [];
const logged: unknown[][] = [];
const handle: ToastHandle = { update: () => undefined, close: () => undefined };

function lookup(prefix: string, table: Record<string, string>): MessageLookup {
	function resolveMessage(key: string, vars?: LooseMessageVars) {
		const text = (table[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
			String(vars?.[name]),
		);

		return `${prefix}:${text}`;
	}

	return { resolveMessage, takesVars: (key) => hasPlaceholders(table[key]) };
}

// Core keys stand in for a plugin's: the lookup below gives them the caller's own text.
const toasts = createFeedbackToasts({
	messages: lookup('plugin', {
		UNBOUND_OK: 'Saved',
		UNBOUND_INSTALL_FAILED: 'Starred {name}',
		UNBOUND_DELETE_TITLE: 'Could not sync {name}',
		UNBOUND_CANCEL: 'Not synced',
	}),
	core: lookup('core', { UNBOUND_SOMETHING_WENT_WRONG: 'Something went wrong' }),
	logger: { error: (...args) => void logged.push(args) },
	show: (options) => {
		shown.push(options);

		return handle;
	},
});

beforeEach(() => {
	shown.length = 0;
	logged.length = 0;
});

describe('toast shorthands', () => {
	test('success, info and warning resolve the key and draw their icon', () => {
		expect(toasts.success('UNBOUND_OK')).toBe(handle);
		toasts.info('UNBOUND_INSTALL_FAILED', { name: 'Rule' });
		toasts.warning('UNBOUND_OK');

		expect(shown).toEqual([
			{ title: 'plugin:Saved', icon: 'CircleCheckIcon' },
			{ title: 'plugin:Starred Rule', icon: 'CircleInformationIcon' },
			{ title: 'plugin:Saved', icon: 'WarningIcon' },
		]);
		expect(logged).toEqual([]);
	});

	test('options follow the vars, or the key when it has none, and take only icon, duration and id', () => {
		const stray = { id: 'sync', duration: 1000, content: 'ignored' };

		toasts.success(
			'UNBOUND_INSTALL_FAILED',
			{ name: 'Rule' },
			{ duration: 0, icon: 'StarIcon' },
		);
		toasts.info('UNBOUND_OK', stray);

		expect(shown).toEqual([
			{ title: 'plugin:Starred Rule', icon: 'StarIcon', duration: 0 },
			{ title: 'plugin:Saved', icon: 'CircleInformationIcon', id: 'sync', duration: 1000 },
		]);
	});

	test('error with an Error shows a generic title, its message, and logs it', () => {
		const failure = new Error('Network is offline');

		toasts.error(failure);

		expect(shown).toEqual([
			{
				title: 'core:Something went wrong',
				content: 'Network is offline',
				icon: 'CircleXIcon',
			},
		]);
		expect(logged).toEqual([['core:Something went wrong:', failure]]);
	});

	test('error with a thrown string shows the string', () => {
		toasts.error('Rate limited');

		expect(shown[0]).toMatchObject({
			title: 'core:Something went wrong',
			content: 'Rate limited',
		});
	});

	test('error with an unknown value shows only the title, or its message field', () => {
		toasts.error(42);
		toasts.error({ message: 'From a fetch body' });

		expect(shown.map((options) => options.content)).toEqual([undefined, 'From a fetch body']);
		expect(logged.map(([, cause]) => cause)).toEqual([42, { message: 'From a fetch body' }]);
	});

	test('error after a key titles the toast with it, its vars before the error', () => {
		const failure = new TypeError('bad');

		toasts.error('UNBOUND_DELETE_TITLE', { name: 'Sync' }, failure, { duration: 0 });
		toasts.error('UNBOUND_CANCEL', 'timeout');

		expect(shown).toEqual([
			{
				title: 'plugin:Could not sync Sync',
				content: 'bad',
				icon: 'CircleXIcon',
				duration: 0,
			},
			{ title: 'plugin:Not synced', content: 'timeout', icon: 'CircleXIcon' },
		]);
		expect(logged).toEqual([
			['plugin:Could not sync Sync:', failure],
			['plugin:Not synced:', 'timeout'],
		]);
	});
});
