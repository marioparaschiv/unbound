import { describe, expect, test } from 'bun:test';

import {
	findDiscordAppIcon,
	mergeDiscordAppIconRows,
	mergeDiscordAppIcons,
	resolveDiscordAppIconSelection,
	toDiscordAppIcon,
} from './bridge-icons';

const defaultIcon = {
	id: 'AppIcon',
	nativeId: 'AppIcon',
	name: 'Blurple (Default)',
	iconSource: {},
	isPremium: false,
};

const brandIcon = {
	id: 'BrandInvertedIcon',
	nativeId: 'BrandInvertedIcon',
	name: 'Drocsid',
	iconSource: {},
	isPremium: false,
};

const unboundIcon = {
	id: 'UnboundIcon',
	nativeId: 'BrandInvertedIcon',
	replacesId: 'BrandInvertedIcon',
	name: 'Unbound',
	iconSource: { uri: 'file:///unbound.webp' },
	isPremium: false,
};

describe('app icon bridge', () => {
	test('maps a picker id separately from the native icon id', () => {
		expect(
			toDiscordAppIcon({
				id: 'BrandInvertedIcon',
				pickerId: 'UnboundIcon',
				name: 'Unbound',
				image: 'file:///unbound.webp',
			}),
		).toEqual(unboundIcon);
	});

	test('replaces the sacrificed built-in icon without duplicating it', () => {
		expect(mergeDiscordAppIcons([defaultIcon, brandIcon], [unboundIcon])).toEqual([
			defaultIcon,
			unboundIcon,
		]);
	});

	test('resolves the replacement by either picker or native id', () => {
		expect(findDiscordAppIcon('UnboundIcon', [unboundIcon])).toEqual(unboundIcon);
		expect(findDiscordAppIcon('BrandInvertedIcon', [unboundIcon])).toEqual({
			...unboundIcon,
			id: 'BrandInvertedIcon',
		});
		expect(findDiscordAppIcon('MissingIcon', [unboundIcon])).toBeUndefined();
	});

	test('places the Unbound row where the removed stock row was', () => {
		const otherIcon = { ...brandIcon, id: 'BrandDarkIcon', name: 'Goth' };

		expect(
			mergeDiscordAppIconRows([defaultIcon, brandIcon, otherIcon], [unboundIcon], [], 'add'),
		).toEqual([defaultIcon, unboundIcon, otherIcon]);
	});

	test('maps a picker selection back to the native alias id', () => {
		expect(
			resolveDiscordAppIconSelection({ id: 'UnboundIcon', name: 'Unbound' }, [unboundIcon]),
		).toEqual({
			id: 'BrandInvertedIcon',
			name: 'Unbound',
		});
		expect(resolveDiscordAppIconSelection('UnboundIcon', [unboundIcon])).toBe(
			'BrandInvertedIcon',
		);
		expect(resolveDiscordAppIconSelection('AppIcon', [unboundIcon])).toBe('AppIcon');
	});
});
