import { describe, expect, test } from 'bun:test';

import { sheetLink, withOption } from '~/lib/sheet';

describe('link sheets', () => {
	test('reads the link from the header', () => {
		expect(sheetLink({ header: { subtitle: 'https://unbound.rip' } })).toBe(
			'https://unbound.rip',
		);
		expect(sheetLink({ header: { subtitle: 'Not a link' } })).toBeUndefined();
		expect(sheetLink(undefined)).toBeUndefined();
	});

	test('adds the option once', () => {
		const option = { label: 'Show QR Code', onPress: () => {} };
		const once = withOption({ options: [{ label: 'Open Link', onPress: () => {} }] }, option);

		expect(once.options?.map((item) => item.label)).toEqual(['Open Link', 'Show QR Code']);
		expect(withOption(once, option).options).toHaveLength(2);
	});
});
