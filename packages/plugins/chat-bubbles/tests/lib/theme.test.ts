import { flux } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import { currentAppearance, watchAppearance } from '~/lib/theme';

beforeEach(() => {
	flux.seed({ Theme: { theme: 'dark' } });
});

describe('the bubble appearance', () => {
	test('starts with the default shape and a black, 40% bubble on a dark theme', () => {
		expect(currentAppearance()).toEqual({
			layout: 'dynamic',
			radius: 10,
			horizontalPadding: 8,
			verticalPadding: 4,
			color: { red: 0, green: 0, blue: 0, alpha: 0.4 },
			ownColor: { red: 0, green: 0, blue: 0, alpha: 0.4 },
		});
	});

	test('turns white on the light theme', () => {
		flux.seed({ Theme: { theme: 'light' } });

		expect(currentAppearance().color).toEqual({ red: 1, green: 1, blue: 1, alpha: 0.4 });
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
