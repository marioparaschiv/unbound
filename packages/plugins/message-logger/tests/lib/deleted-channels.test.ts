import { beforeEach, describe, expect, test } from 'bun:test';

import {
	clearDeletedChannels,
	deletedChannels,
	parseDeletedChannels,
	recordDeletedChannel,
	restoreDeletedChannels,
	serializeDeletedChannels,
	type DeletedChannel,
} from '~/lib/deleted-channels';
import { DELETED_CHANNEL_LIMIT } from '~/lib/constants';

function channel(id: string, deletedAt = 1): DeletedChannel {
	return {
		id,
		name: `channel-${id}`,
		type: 0,
		guildId: 'g1',
		guildName: 'Unbound',
		categoryName: '',
		topic: '',
		deletedAt,
	};
}

beforeEach(clearDeletedChannels);

describe('deleted channels', () => {
	test('keeps the newest first without repeating an id', () => {
		recordDeletedChannel(channel('a'));
		recordDeletedChannel(channel('b'));
		recordDeletedChannel(channel('a', 2));

		expect(deletedChannels().map((entry) => entry.id)).toEqual(['a', 'b']);
		expect(deletedChannels()[0]?.deletedAt).toBe(2);
	});

	test('drops the oldest past the limit', () => {
		for (let index = 0; index <= DELETED_CHANNEL_LIMIT; index++) {
			recordDeletedChannel(channel(String(index)));
		}

		expect(deletedChannels()).toHaveLength(DELETED_CHANNEL_LIMIT);
		expect(deletedChannels().at(-1)?.id).toBe('1');
	});

	test('restores saved channels behind ones recorded since launch', () => {
		recordDeletedChannel(channel('new'));
		restoreDeletedChannels([channel('old'), channel('new')]);

		expect(deletedChannels().map((entry) => entry.id)).toEqual(['new', 'old']);
	});

	test('reads back what it saves and skips malformed entries', () => {
		const text = serializeDeletedChannels([channel('a')]);
		const tampered = JSON.stringify({ version: 1, channels: [channel('b'), { id: 'c' }] });

		expect(parseDeletedChannels(text)).toEqual([channel('a')]);
		expect(parseDeletedChannels(tampered)).toEqual([channel('b')]);
		expect(parseDeletedChannels('{"version":2}')).toBeUndefined();
		expect(parseDeletedChannels('not json')).toBeUndefined();
	});
});
