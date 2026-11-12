import { describe, expect, test } from 'bun:test';

import { parsePlist } from '~/plist';

describe('parsePlist', () => {
	test('reads every value type as JSON', () => {
		const xml = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
			'<plist version="1.0">',
			'<dict>',
			'\t<key>aps-environment</key>',
			'\t<string>production</string>',
			'\t<key>get-task-allow</key>',
			'\t<false/>',
			'\t<key>limit</key>',
			'\t<integer>42</integer>',
			'\t<key>groups</key>',
			'\t<array>',
			'\t\t<string>a &amp; b</string>',
			'\t\t<dict/>',
			'\t\t<array/>',
			'\t</array>',
			'\t<key>empty</key>',
			'\t<string></string>',
			'</dict>',
			'</plist>',
		].join('\n');

		expect(parsePlist(xml)).toEqual({
			'aps-environment': 'production',
			'get-task-allow': false,
			limit: 42,
			groups: ['a & b', {}, []],
			empty: '',
		});
	});

	test('returns undefined for text that is not a plist', () => {
		expect(parsePlist('not xml')).toBeUndefined();
		expect(parsePlist('<plist version="1.0"><dict><key>a</key>')).toBeUndefined();
	});
});
