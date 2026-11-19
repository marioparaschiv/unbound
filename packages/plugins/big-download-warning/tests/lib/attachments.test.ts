import { describe, expect, test } from 'bun:test';

import { attachmentByUrl } from '~/lib/attachments';

const zip = {
	url: 'https://cdn.discordapp.com/attachments/1/2/logs.zip?ex=aa&is=bb&hm=cc',
	proxy_url: 'https://media.discordapp.net/attachments/1/2/logs.zip?ex=aa&is=bb&hm=cc',
	size: 52_428_800,
};

describe('attachments', () => {
	test('matches a tapped file by its address without the signed query', () => {
		expect(
			attachmentByUrl(
				[zip],
				'https://cdn.discordapp.com/attachments/1/2/logs.zip?ex=dd&hm=ee',
			),
		).toBe(zip);
	});

	test('matches the media proxy address too', () => {
		expect(
			attachmentByUrl([zip], 'https://media.discordapp.net/attachments/1/2/logs.zip'),
		).toBe(zip);
	});

	test('finds nothing for a file the loaded messages lack', () => {
		expect(
			attachmentByUrl([zip], 'https://cdn.discordapp.com/attachments/1/3/other.zip'),
		).toBeUndefined();
	});
});
