import { describe, expect, test } from 'bun:test';

import { findFlights, trackerLink } from '~/lib/flights';
import { readStatus } from '~/lib/position';

describe('findFlights', () => {
	test('reads IATA flight numbers and ICAO callsigns of known airlines', () => {
		expect(findFlights('Landing on LH400, then BA 286 and RYR15XN')).toEqual([
			{ flight: 'LH400', callsign: 'DLH400' },
			{ flight: 'BA286', callsign: 'BAW286' },
			{ flight: 'RYR15XN', callsign: 'RYR15XN' },
		]);
	});

	test('leaves other codes alone', () => {
		expect(findFlights('I got 99 problems in Q4 with ZZ123 and ABC123')).toEqual([]);
	});

	test('links the tracker', () => {
		expect(trackerLink('LH400')).toBe('https://www.flightradar24.com/data/flights/lh400');
	});
});

describe('readStatus', () => {
	test('reads an airborne flight', () => {
		expect(
			readStatus([
				{
					alt_baro: 36049,
					gs: 416.2,
					track: 239,
					baro_rate: -1200,
					t: 'B38M',
					r: 'EI-IKI',
				},
			]),
		).toEqual({
			state: 'airborne',
			altitude: 36000,
			speed: 416,
			heading: 'SW',
			vertical: 'descending',
			type: 'B38M',
			registration: 'EI-IKI',
		});
	});

	test('reads ground and unseen flights', () => {
		expect(readStatus([{ alt_baro: 'ground', t: 'A320' }])).toEqual({
			state: 'ground',
			type: 'A320',
			registration: undefined,
		});
		expect(readStatus([])).toEqual({ state: 'unseen' });
	});
});
