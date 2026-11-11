import { expect, test } from 'bun:test';

import { renderMenu } from '~/lib/menu';

test('renderMenu lists entries under their headings, marking groups', () => {
	const menu = renderMenu({
		invocation: 'ubd',
		tagline: 'the toolkit',
		sections: [
			{ title: 'Addons', entries: [{ name: 'create', summary: 'Scaffold.' }] },
			{ title: 'Device', entries: [{ name: 'debug', summary: 'Drive.', group: true }] },
		],
		hints: ['A hint.'],
	});
	// CI forces color on, so compare the text without its escape codes.
	const lines = Bun.stripANSI(menu)
		.split('\n')
		.map((line) => line.trim());

	expect(lines).toContain('ubd <command> [flags]');
	expect(lines.indexOf('Addons')).toBeLessThan(lines.indexOf('Device'));
	expect(lines.some((line) => /^create\s+Scaffold\.$/.test(line))).toBe(true);
	expect(lines.some((line) => /^debug <command>\s+Drive\.$/.test(line))).toBe(true);
	expect(lines).toContain('A hint.');
});
