import { expect, test } from 'bun:test';

import { resolveCrownSource } from '@force-owner-crown/crown';

test('uses the stable embed URI when the native asset URI is transient', () => {
	const source = resolveCrownSource(
		42,
		() => ({ uri: 'asset://temporary/crown.png' }),
		() => 'file:///var/mobile/Library/Caches/crown.png',
	);

	expect(source).toBe('file:///var/mobile/Library/Caches/crown.png');
});

test('falls back to the registered asset id when no URI is usable', () => {
	const source = resolveCrownSource(
		42,
		() => ({ uri: '' }),
		() => null,
	);

	expect(source).toBe(42);
});
