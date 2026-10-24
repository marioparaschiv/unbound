import { describe, expect, test } from 'bun:test';

import { resolveTagColors } from './tag-colors';

const allOn = { useRoleColor: true, useEnhancedRoleColors: true, coloredTags: true };
const member = {
	colorString: '#123456',
	colorStrings: { primaryColor: '#123456', secondaryColor: '#789abc' },
};

describe('resolveTagColors', () => {
	test("uses the member's role colors first", () => {
		expect(resolveTagColors('#248046', [member, { colorString: '#abcdef' }], allOn)).toEqual({
			colors: ['#123456', '#789abc'],
			style: 'gradient',
		});
	});

	test("falls back to the message's role color when the member is not cached", () => {
		expect(resolveTagColors('#248046', [undefined, { colorString: '#123456' }], allOn)).toEqual(
			{ colors: ['#123456'], style: 'solid' },
		);
	});

	test('drops gradients when enhanced role colors are off', () => {
		const options = { ...allOn, useEnhancedRoleColors: false };

		expect(resolveTagColors('#248046', [member], options)).toEqual({
			colors: ['#123456'],
			style: 'solid',
		});
	});

	test("uses the tag's own color when role colors are off or missing", () => {
		const options = { ...allOn, useRoleColor: false };

		expect(resolveTagColors('#248046', [member], options).colors).toEqual(['#248046']);
		expect(resolveTagColors('#248046', [undefined, {}], allOn).colors).toEqual(['#248046']);
	});

	test("leaves Discord's styling when coloured tags are off", () => {
		const options = { ...allOn, useRoleColor: false, coloredTags: false };

		expect(resolveTagColors('#248046', [member], options)).toEqual({
			colors: [],
			style: 'solid',
		});
	});
});
