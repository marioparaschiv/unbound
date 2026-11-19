import { describe, expect, test } from 'bun:test';

import { attachmentFileName, isPdf, safeFileName } from '~/lib/pdf-files';

describe('pdf files', () => {
	test('recognises PDFs by name', () => {
		expect(isPdf('Report.PDF')).toBe(true);
		expect(isPdf('notes.txt')).toBe(false);
		expect(isPdf(undefined)).toBe(false);
	});

	test('keeps file names safe to write', () => {
		expect(safeFileName('my report (final).pdf')).toBe('my_report_final_.pdf');
		expect(safeFileName('../x.pdf')).toBe('_x.pdf');
		expect(safeFileName('weird')).toBe('weird.pdf');
	});
});

describe('attachment file names', () => {
	test('reads the file name of a Discord attachment link', () => {
		expect(
			attachmentFileName(
				'https://cdn.discordapp.com/attachments/1/2/My%20Report.pdf?ex=aa&hm=bb',
			),
		).toBe('My Report.pdf');
		expect(attachmentFileName('https://media.discordapp.net/attachments/1/2/a.pdf')).toBe(
			'a.pdf',
		);
	});

	test('ignores other links', () => {
		expect(attachmentFileName('https://example.com/attachments/1/2/a.pdf')).toBeUndefined();
		expect(attachmentFileName('not a url')).toBeUndefined();
	});
});
