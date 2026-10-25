import { describe, expect, test } from 'bun:test';

import { androidResourceName, androidResourceUri } from './android-resource';

describe('androidResourceName', () => {
	test('matches the drawable names React Native bundles', () => {
		const crown = { httpServerLocation: '/assets/images/native/icons', name: 'ic_crown_16px' };

		expect(androidResourceName(crown)).toBe('images_native_icons_ic_crown_16px');
		expect(androidResourceUri(crown)).toBe(
			'android.resource://com.discord/drawable/images_native_icons_ic_crown_16px',
		);
	});

	test('drops characters Android resource names cannot hold', () => {
		expect(
			androidResourceName({ httpServerLocation: '/assets/design/Icons-2', name: 'Big.Icon' }),
		).toBe('design_icons2_bigicon');
	});
});
