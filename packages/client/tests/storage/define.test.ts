import type { SettingsSchema } from '@unbound-app/types/settings';
import { describe, expect, mock, test } from 'bun:test';

import type { SettingsValues } from '~/storage/define';

type Effect = () => (() => void) | void;

const cleanups: Array<(() => void) | void> = [];

const React = await import('react');

// Hooks run once with no renderer: state is the initial value, and effects subscribe at once. The rest of React stays
// real, as the mock outlives this file in a shared test run.
mock.module('react', () => ({
	...React,
	default: React,
	useState: <T>(initial: T | (() => T)) => [
		initial instanceof Function ? initial() : initial,
		() => {},
	],
	useEffect: (effect: Effect) => void cleanups.push(effect()),
}));

const storage = await import('~/storage/api');

const schema: SettingsSchema = {
	kind: 'settings',
	properties: {
		enabled: { kind: 'boolean', displayAs: 'switch', title: 'A', default: true },
		size: {
			kind: 'integer',
			displayAs: 'slider',
			title: 'B',
			default: 14,
			minimum: 10,
			maximum: 24,
		},
		token: { kind: 'string', displayAs: 'secret', title: 'C', default: '' },
		badge: {
			kind: 'section',
			displayAs: 'group',
			title: 'D',
			properties: {
				color: { kind: 'string', displayAs: 'color', title: 'E', default: '#FFFFFF' },
				clear: { kind: 'button', displayAs: 'button', title: 'F', action: 'clear' },
			},
		},
	},
};

let count = 0;

function define() {
	count += 1;

	return {
		name: `define-test-${count}`,
		settings: storage.define(schema, `define-test-${count}`),
	};
}

describe('storage.define', () => {
	test('reads defaults, sections included', () => {
		const { settings } = define();

		expect(settings.values.enabled).toBe(true);
		expect(settings.values.size).toBe(14);
		expect({ ...(settings.values.badge as object) }).toEqual({ color: '#FFFFFF' });
		expect(Object.keys(settings.values)).toEqual(['enabled', 'size', 'token', 'badge']);
	});

	test('saves writes to its Bucket, nested ones too', () => {
		const { name, settings } = define();

		settings.values.size = 20;
		(settings.values.badge as SettingsValues).color = '#000000';

		expect(storage.getBucket(name).get('size', 0)).toBe(20);
		expect(storage.getBucket(name).get('badge.color', '')).toBe('#000000');
	});

	test('rejects a write its schema rejects', () => {
		const { settings } = define();

		expect(() => (settings.values.size = 30)).toThrow(
			'Failed to set setting size: 30 does not match its schema.',
		);
		expect(() => (settings.values.missing = 1)).toThrow(
			'Failed to set setting missing: it is not a setting.',
		);
		expect(() => (settings.values.badge = {})).toThrow('it is not a setting');
	});

	test('reads an invalid stored value as its default and removes it', () => {
		const { name, settings } = define();

		storage.getBucket(name).set('size', 'big');

		expect(settings.values.size).toBe(14);
		expect(storage.getBucket(name).get('size', undefined)).toBeUndefined();
	});

	test('resets only its own settings', () => {
		const { name, settings } = define();

		settings.values.enabled = false;
		storage.getBucket(name).set('other', 1);
		settings.reset();

		expect(settings.values.enabled).toBe(true);
		expect(storage.getBucket(name).get('other', 0)).toBe(1);
	});

	test('masks a secret in a snapshot', () => {
		const { name, settings } = define();

		settings.values.token = 'hunter2';

		expect(storage.snapshot()[name]).toMatchObject({ token: '[secret]' });
		expect(storage.snapshot({ includeSecrets: true })[name]).toMatchObject({
			token: 'hunter2',
		});
	});

	test('reads a section as one object', () => {
		const { settings } = define();

		expect(settings.useSetting('badge')).toEqual({ color: '#FFFFFF' });
		expect(settings.useSetting('badge.color')).toBe('#FFFFFF');
	});
});

const { affects } = await import('~/storage/define');

describe('affects', () => {
	test('reaches a key, its section and the settings inside it', () => {
		const change = (key: string | null) => ({ store: 's', key, value: undefined });

		expect(affects(change('badge.color'), 'badge')).toBe(true);
		expect(affects(change('badge.color'), 'badge.color')).toBe(true);
		expect(affects(change('badge'), 'badge.color')).toBe(true);
		expect(affects(change(null), 'size')).toBe(true);
		expect(affects(change('badge.size'), 'badge.color')).toBe(false);
		expect(affects(change('badges'), 'badge')).toBe(false);
	});
});
