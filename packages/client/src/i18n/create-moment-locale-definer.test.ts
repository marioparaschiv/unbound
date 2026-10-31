import { expect, test } from 'bun:test';

import createMomentLocaleDefiner from './create-moment-locale-definer';

test('restores the active locale after a locale is defined', () => {
	let globalLocale = 'en';
	const defineLocale = createMomentLocaleDefiner(
		(name: string) => {
			globalLocale = name;

			return name;
		},
		() => (globalLocale = 'en'),
	);

	expect(defineLocale('hi')).toBe('hi');
	expect(globalLocale).toBe('en');
});
