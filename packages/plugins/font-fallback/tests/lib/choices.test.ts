import { describe, expect, test } from 'bun:test';

import { familyFaces, parseChoices } from '~/lib/choices';

describe('parseChoices', () => {
	test('keeps string choices and drops the rest', () => {
		expect(parseChoices('{"han":"NotoSansJP-Regular","kana":4}')).toEqual({
			han: 'NotoSansJP-Regular',
		});
	});

	test('starts over on malformed JSON', () => {
		expect(parseChoices('{nope')).toEqual({});
		expect(parseChoices('')).toEqual({});
	});
});

describe('familyFaces', () => {
	test('offers the upright face nearest regular weight for each family', () => {
		const faces = [
			{ id: 'a-bold', family: 'Alpha', weight: 700, style: 'normal' },
			{ id: 'a-reg', family: 'Alpha', weight: 400, style: 'normal' },
			{ id: 'a-it', family: 'Alpha', weight: 400, style: 'italic' },
			{ id: 'b-med', family: 'Beta', weight: 500, style: 'normal' },
		];

		expect(familyFaces(faces).map(({ id }) => id)).toEqual(['a-reg', 'b-med']);
	});
});
