import { describe, expect, test } from 'bun:test';

import { dropInvalidPlaceholders, type RowMessage } from '~/core/row-placeholders';

const VALID = 'DAiCA4Ardm1vuYt9QP0b0goZiIdwiRg=';

describe('dropInvalidPlaceholders', () => {
	test('clears malformed placeholders in attachments and embeds, keeping valid ones', () => {
		const message: RowMessage = {
			id: 'm1',
			attachments: [{ placeholder: VALID }, { placeholder: 'PwAAAAAA' }],
			embeds: [
				{ image: { placeholder: 'AAAA' }, thumbnail: { placeholder: VALID } },
				{ images: [{ placeholder: 'garbage!' }, { placeholder: null }] },
			],
		};

		expect(dropInvalidPlaceholders(message)).toBe(3);
		expect(message.attachments?.map((item) => item.placeholder)).toEqual([VALID, null]);
		expect(message.embeds?.[0]?.image?.placeholder).toBeNull();
		expect(message.embeds?.[0]?.thumbnail?.placeholder).toBe(VALID);
		expect(message.embeds?.[1]?.images?.map((item) => item.placeholder)).toEqual([null, null]);
	});

	test('leaves a message without images alone', () => {
		expect(dropInvalidPlaceholders({ id: 'm2' })).toBe(0);
	});
});
