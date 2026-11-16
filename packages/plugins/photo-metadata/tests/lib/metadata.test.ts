import { describe, expect, test } from 'bun:test';

import {
	asJpegName,
	decide,
	formatLocation,
	isPhoto,
	locationOf,
	signedCoordinate,
} from '~/lib/metadata';

describe('metadata', () => {
	test('recognises photos by type or name', () => {
		expect(isPhoto({ uri: 'ph://x', filename: 'IMG_1.HEIC' })).toBe(true);
		expect(isPhoto({ uri: 'content://1', mimeType: 'image/jpeg' })).toBe(true);
		expect(isPhoto({ uri: 'file:///a.mp4', filename: 'a.mp4' })).toBe(false);
	});

	test('signs coordinates and ignores zeroed ones', () => {
		expect(signedCoordinate(33.5, 'S')).toBe(-33.5);
		expect(signedCoordinate('11.57', 'E')).toBe(11.57);
		expect(signedCoordinate(0, 'N')).toBeUndefined();
		expect(locationOf(1, undefined)).toBeUndefined();
	});

	test('decides from the settings', () => {
		const located = { location: { latitude: 1, longitude: 2 } };
		const camera = { camera: 'Pixel' };

		expect(decide(located, { removeLocation: true, removeAll: false })).toBe('strip');
		expect(decide(located, { removeLocation: false, removeAll: false })).toBe('warn');
		expect(decide(camera, { removeLocation: true, removeAll: false })).toBe('keep');
		expect(decide(camera, { removeLocation: true, removeAll: true })).toBe('strip');
		expect(decide({}, { removeLocation: true, removeAll: true })).toBe('keep');
	});

	test('formats locations and JPEG names', () => {
		expect(formatLocation({ latitude: 48.14166, longitude: -11.57 })).toBe(
			'48.1417° N, 11.5700° W',
		);
		expect(asJpegName('IMG_1.HEIC')).toBe('IMG_1.jpg');
	});
});
