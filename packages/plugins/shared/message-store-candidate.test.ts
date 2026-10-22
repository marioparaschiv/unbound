import { describe, expect, test } from 'bun:test';

import { isMessageStoreCandidate } from '@shared/message-store-candidate';

describe('message store candidate', () => {
	test('accepts a message store with inherited methods', () => {
		class Store {
			getName() {
				return 'MessageStore';
			}
		}
		class MessageStore extends Store {
			_dispatcher = {};
			getMessage() {
				return null;
			}
		}

		expect(isMessageStoreCandidate(new MessageStore())).toBe(true);
	});

	test('does not ask translation proxies for store names', () => {
		let lookups = 0;
		const translation = new Proxy(
			{},
			{
				get(_target, name) {
					if (name === 'getName') lookups++;
					return () => 'MessageStore';
				},
			},
		);

		expect(isMessageStoreCandidate(translation)).toBe(false);
		expect(lookups).toBe(0);
	});

	test('ignores revoked proxies', () => {
		const candidate = Proxy.revocable({}, {});
		candidate.revoke();
		expect(isMessageStoreCandidate(candidate.proxy)).toBe(false);
	});
});
