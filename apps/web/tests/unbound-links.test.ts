import { expect, test } from 'bun:test';

import { canOpenUnboundLinks } from '~/lib/unbound-links';
import type { NavigatorLike } from '~/lib/unbound-links';

type Case = [name: string, nav: NavigatorLike, expected: boolean];

const MAC_SAFARI =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

test('only iPhone, iPod and iPad browsers open unbound:// links', () => {
	const cases: Case[] = [
		[
			'iPhone Safari',
			{
				userAgent:
					'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
				platform: 'iPhone',
				maxTouchPoints: 5,
			},
			true,
		],
		[
			'iPod',
			{
				userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)',
				platform: 'iPod',
				maxTouchPoints: 5,
			},
			true,
		],
		[
			'iPad Chrome',
			{
				userAgent:
					'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
				platform: 'iPad',
				maxTouchPoints: 5,
			},
			true,
		],
		[
			'iPadOS desktop mode',
			{ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 5 },
			true,
		],
		['Mac Safari', { userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 }, false],
		[
			'Android Chrome',
			{
				userAgent:
					'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
				platform: 'Linux armv81',
				maxTouchPoints: 5,
			},
			false,
		],
		[
			'Windows touch laptop',
			{
				userAgent:
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
				platform: 'Win32',
				maxTouchPoints: 10,
			},
			false,
		],
	];

	for (const [name, nav, expected] of cases) {
		expect({ name, opens: canOpenUnboundLinks(nav) }).toEqual({ name, opens: expected });
	}
});
