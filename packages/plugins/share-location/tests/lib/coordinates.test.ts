import { expect, test } from 'bun:test';

import { mapLink, readCoordinates } from '~/lib/coordinates';

test('reads a CLLocation description', () => {
	expect(readCoordinates('<+48.85840123,+2.29450987> +/- 5.00m (speed -1.00 mps)')).toEqual({
		latitude: 48.85840123,
		longitude: 2.29450987,
	});
	expect(readCoordinates('<+95.0,+2.0>')).toBeUndefined();
	expect(readCoordinates('nothing')).toBeUndefined();
});

test('links to the spot rounded to about a metre', () => {
	expect(mapLink({ latitude: 48.85840123, longitude: -2.29450987 })).toBe(
		'https://www.google.com/maps/search/?api=1&query=48.8584,-2.29451',
	);
});
