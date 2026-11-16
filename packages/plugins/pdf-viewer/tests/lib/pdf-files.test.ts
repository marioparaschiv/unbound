import { describe, expect, test } from 'bun:test';

import { isPdf, safeFileName } from '~/lib/pdf-files';

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
