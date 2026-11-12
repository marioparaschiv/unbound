import { flux } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import { currentAppearance, watchAppearance } from '~/lib/theme';

beforeEach(() => {
	flux.seed({ Theme: { theme: 'dark' } });
});

describe('the bubble appearance', () => {
	test('starts with the default shape and a solid #222222 bubble on a dark theme', () => {
		expect(currentAppearance()).toEqual({
			layout: 'dynamic',
			radius: 16,
			horizontalPadding: 14,
			verticalPadding: 10,
			spacing: 6,
			mediaCorners: 'none',
			cornerCurve: 'continuous',
			grouping: 'grouped',
			roundExposed: true,
			roundOuter: true,
			groupSpacing: 4,
			joinCurves: true,
			smoothSteps: true,
			roomyRows: true,
			avatarLast: false,
			nameInside: true,
			reply: 'quote',
			tail: 'off',
			tailSize: 8,
			color: { red: 0x22 / 255, green: 0x22 / 255, blue: 0x22 / 255, alpha: 1 },
			ownColor: { red: 0x22 / 255, green: 0x22 / 255, blue: 0x22 / 255, alpha: 1 },
			blur: 0,
			mention: { color: undefined, alpha: 0.4, width: 0.5, tint: 0.12 },
		});
	});

	test('turns light grey on the light theme', () => {
		flux.seed({ Theme: { theme: 'light' } });

		expect(currentAppearance().color).toEqual({
			red: 0xe9 / 255,
			green: 0xe9 / 255,
			blue: 0xeb / 255,
			alpha: 1,
		});
	});

	test('follows the saved settings, with your own messages in their own color', () => {
		settings.layout = 'card';
		settings.radius = 20;
		settings.opacity = 100;
		settings.color = '#ff0000';
		settings.ownColor = '#0000ff';

		expect(currentAppearance()).toMatchObject({
			layout: 'card',
			radius: 20,
			color: { red: 1, green: 0, blue: 0, alpha: 1 },
			ownColor: { red: 0, green: 0, blue: 1, alpha: 1 },
		});
	});

	test('keeps a saved value inside its limit', () => {
		settings.radius = 500;

		expect(currentAppearance().radius).toBe(32);
	});
});

describe('watching the appearance', () => {
	test('tells the plugin when a bubble setting changes', () => {
		let changes = 0;

		watchAppearance(() => (changes += 1));
		settings.radius = 14;

		expect(changes).toBe(1);
	});

	test('tells the plugin when the theme changes', () => {
		let changes = 0;

		watchAppearance(() => (changes += 1));
		flux.emit('Theme');

		expect(changes).toBe(1);
	});
});
