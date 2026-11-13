import { describe, expect, test } from 'bun:test';

import { createTimezoneLookup } from '~/lib/lookup';

function respond(body: unknown, ok = true) {
	return Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('TimezoneDB lookup', () => {
	test('looks a user up once, caches the timezone and redraws', async () => {
		const asked: string[] = [];
		let redraws = 0;
		const lookup = createTimezoneLookup(
			() => redraws++,
			(url) => {
				asked.push(url);

				return respond({ user: { id: '1' }, timezone: 'Europe/Berlin' });
			},
		);

		expect(lookup.get('1')).toBeUndefined();
		expect(lookup.get('1')).toBeUndefined();
		await settle();

		expect(lookup.get('1')).toBe('Europe/Berlin');
		expect(asked).toEqual(['https://timezone.creations.works/get?id=1']);
		expect(redraws).toBe(1);
	});

	test('remembers users it could not find without redrawing', async () => {
		let redraws = 0;
		const lookup = createTimezoneLookup(
			() => redraws++,
			() => respond({ message: 'User not found' }, false),
		);

		lookup.get('2');
		await settle();

		expect(lookup.get('2')).toBeUndefined();
		expect(redraws).toBe(0);
	});

	test('drops a lookup that lands after it was disposed', async () => {
		const lookup = createTimezoneLookup(
			() => undefined,
			() => respond({ timezone: 'Asia/Tokyo' }),
		);

		lookup.get('3');
		lookup.dispose();
		await settle();

		expect(lookup.get('3')).toBeUndefined();
	});
});
