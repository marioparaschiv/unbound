import { flux } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

import { subscribeMessageStore } from '~/native/ios/message-sync';
import type { Session } from '~/native/ios/session';

function seedStore() {
	const reads: string[] = [];
	flux.seed({
		Message: {
			getMessage: () => undefined,
			getMessages: (channelId: string) => {
				reads.push(channelId);

				return { _array: [] };
			},
		},
		SelectedChannel: { getChannelId: () => 'c1', getLastSelectedChannelId: () => 'c1' },
	});

	return reads;
}

const session = { surfaces: new Map() } as unknown as Session;

describe('following the message store', () => {
	test('scans the loaded window when the store changes', () => {
		const reads = seedStore();
		const unsubscribe = subscribeMessageStore(session);

		flux.emit('Message');
		unsubscribe();

		expect(reads).toEqual(['c1']);
	});

	test('stops reading once unsubscribed', () => {
		const reads = seedStore();

		subscribeMessageStore(session)();
		flux.emit('Message');

		expect(reads).toEqual([]);
	});
});
