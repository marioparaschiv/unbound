import { describe, expect, test } from 'bun:test';

import { convertText as convertWithNbsp, type TargetSystem } from '~/lib/units';

const convertText = (text: string, target: TargetSystem) =>
	convertWithNbsp(text, target).replaceAll('\u00a0', ' ');

describe('convertText', () => {
	test('adds a metric conversion after imperial lengths', () => {
		expect(convertText('it is 5 ft tall', 'metric')).toBe('it is 5 ft (≈ 1.52 m) tall');
		expect(convertText('ran 3 miles', 'metric')).toBe('ran 3 miles (≈ 4.83 km)');
		expect(convertText('a 12in board', 'metric')).toBe('a 12in (≈ 30.5 cm) board');
	});

	test('reads feet and inches together', () => {
		expect(convertText("I'm 5'11\"", 'metric')).toBe("I'm 5'11\" (≈ 1.8 m)");
		expect(convertText('5 ft 11 in', 'metric')).toBe('5 ft 11 in (≈ 1.8 m)');
	});

	test('converts weight, volume, speed and temperature', () => {
		expect(convertText('150 lbs', 'metric')).toBe('150 lbs (≈ 68 kg)');
		expect(convertText('8 oz', 'metric')).toBe('8 oz (≈ 227 g)');
		expect(convertText('2 gallons', 'metric')).toBe('2 gallons (≈ 7.57 L)');
		expect(convertText('going 60 mph', 'metric')).toBe('going 60 mph (≈ 96.6 km/h)');
		expect(convertText('it is 75°F', 'metric')).toBe('it is 75°F (≈ 23.9 °C)');
	});

	test('converts metric to imperial', () => {
		expect(convertText('10 km', 'imperial')).toBe('10 km (≈ 6.21 mi)');
		expect(convertText('180cm', 'imperial')).toBe('180cm (≈ 5\'11")');
		expect(convertText('2 kg', 'imperial')).toBe('2 kg (≈ 4.41 lb)');
		expect(convertText('500 ml', 'imperial')).toBe('500 ml (≈ 16.9 fl oz)');
		expect(convertText('-5 °C', 'imperial')).toBe('-5 °C (≈ 23 °F)');
		expect(convertText('100 km/h', 'imperial')).toBe('100 km/h (≈ 62.1 mph)');
	});

	test('converts both ways when asked', () => {
		expect(convertText('5 km or 3 mi', 'both')).toBe('5 km (≈ 3.11 mi) or 3 mi (≈ 4.83 km)');
	});

	test('leaves the target system, code, links and mentions alone', () => {
		expect(convertText('5 km', 'metric')).toBe('5 km');
		expect(convertText('`5 ft` and ```\n3 mi\n```', 'metric')).toBe(
			'`5 ft` and ```\n3 mi\n```',
		);
		expect(convertText('see https://example.com/5ft', 'metric')).toBe(
			'see https://example.com/5ft',
		);
		expect(convertText('<@5> <:ft:12345>', 'metric')).toBe('<@5> <:ft:12345>');
	});

	test('ignores words that only start like units', () => {
		expect(convertText('5 minutes, 3 into, 2 left, 4 gifts, 9 min', 'metric')).toBe(
			'5 minutes, 3 into, 2 left, 4 gifts, 9 min',
		);
		expect(convertText('5 m', 'metric')).toBe('5 m');
	});

	test('keeps each conversion on one line', () => {
		expect(convertWithNbsp('75°F', 'metric')).toBe('75°F (≈\u00a023.9\u00a0°C)');
	});

	test('returns the same string when nothing converts', () => {
		const text = 'nothing to see here';

		expect(convertWithNbsp(text, 'both')).toBe(text);
	});
});
