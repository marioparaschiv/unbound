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
		expect(message).toEqual({
			id: 'm1',
			attachments: [{ placeholder: VALID }, { placeholder: null }],
			embeds: [
				{ image: { placeholder: null }, thumbnail: { placeholder: VALID } },
				{ images: [{ placeholder: null }, { placeholder: null }] },
			],
		});
	});

	test('clears malformed placeholders in components and forwarded snapshots', () => {
		const message: RowMessage = {
			id: 'm3',
			components: [
				{
					type: 17,
					components: [
						{ type: 11, media: { url: 'a', placeholder: 'PwAAAAAA' } },
						{ type: 12, items: [{ media: { placeholder: VALID } }] },
					],
				},
			],
			messageSnapshots: [{ message: { attachments: [{ placeholder: 'AAAA' }] } }],
			embeds: [{ video: { placeholder: 'AAAA' } }],
		};

		expect(dropInvalidPlaceholders(message)).toBe(3);
		expect(JSON.stringify(message)).toContain(VALID);
		expect(JSON.stringify(message)).not.toContain('PwAAAAAA');
	});

	test('keeps the hint text of select menus and other components', () => {
		const message: RowMessage = {
			id: 'm5',
			components: [
				{
					type: 1,
					components: [
						{
							type: 3,
							placeholder: 'Choose a category to view its commands',
							options: [],
						},
						{ type: 5, placeholder: 'Pick' },
					],
				},
			],
		};

		expect(dropInvalidPlaceholders(message)).toBe(0);
		expect(JSON.stringify(message)).toContain('Choose a category to view its commands');
		expect(JSON.stringify(message)).toContain('"placeholder":"Pick"');
	});

	test('stops at cycles', () => {
		const message: RowMessage = { id: 'm4', attachments: [{ placeholder: 'AAAA' }] };

		(message as { self?: RowMessage }).self = message;

		expect(dropInvalidPlaceholders(message)).toBe(1);
	});

	test('leaves a message without images alone', () => {
		expect(dropInvalidPlaceholders({ id: 'm2' })).toBe(0);
	});
});
