import { describe, expect, test } from 'bun:test';

import { findPlaces } from '~/lib/places';

const eiffel = (zoom = 15) => ({ latitude: 48.8584, longitude: 2.2945, zoom });

describe('findPlaces', () => {
	test('reads Google Maps links', () => {
		expect(
			findPlaces('https://www.google.com/maps/place/Eiffel/@48.8584,2.2945,17z/data=x'),
		).toEqual([eiffel(17)]);
		expect(
			findPlaces('https://www.google.com/maps/search/?api=1&query=48.8584%2C2.2945'),
		).toEqual([eiffel()]);
	});

	test('reads Apple Maps links', () => {
		expect(findPlaces('https://maps.apple.com/?ll=48.8584,2.2945&z=12&q=Eiffel')).toEqual([
			eiffel(12),
		]);
	});

	test('reads OpenStreetMap links', () => {
		expect(findPlaces('https://www.openstreetmap.org/#map=16/48.8584/2.2945')).toEqual([
			eiffel(16),
		]);
		expect(
			findPlaces('https://www.openstreetmap.org/?mlat=48.8584&mlon=2.2945#map=14/48.8/2.2'),
		).toEqual([eiffel(14)]);
	});

	test('reads geo links and bare coordinates', () => {
		expect(findPlaces('geo:48.8584,2.2945')).toEqual([eiffel()]);
		expect(findPlaces('meet at 48.8584, 2.2945 tomorrow')).toEqual([eiffel()]);
	});

	test('ignores numbers that are not coordinates', () => {
		expect(findPlaces('version 1.2, 3.4 and 1.25, 2.5')).toEqual([]);
		expect(findPlaces('95.1234, 10.1234')).toEqual([]);
		expect(findPlaces('1,234.567, 8.901')).toEqual([]);
		expect(findPlaces('https://example.com/@48.8584,2.2945,17z')).toEqual([]);
	});

	test('keeps two places at most, each once', () => {
		expect(findPlaces('1.123, 2.123 1.123, 2.123 3.123, 4.123 5.123, 6.123')).toHaveLength(2);
	});
});
