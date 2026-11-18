import { describe, expect, test } from 'bun:test';

import { newIncidents, readIncidents, rememberAnnounced, type Incident } from '~/lib/incidents';

const incident = (id: string, impact: string): Incident => ({
	id,
	name: `Incident ${id}`,
	status: 'investigating',
	impact,
	shortlink: `https://stspg.io/${id}`,
});

describe('incidents', () => {
	test('reads only well-formed incidents', () => {
		expect(readIncidents({ incidents: [incident('a', 'major'), { id: 1 }] })).toEqual([
			incident('a', 'major'),
		]);
		expect(readIncidents({})).toEqual([]);
	});

	test('announces new major incidents, and minor ones only when asked', () => {
		const list = [incident('a', 'major'), incident('b', 'minor'), incident('c', 'critical')];

		expect(newIncidents(list, ['c'], false).map((item) => item.id)).toEqual(['a']);
		expect(newIncidents(list, ['c'], true).map((item) => item.id)).toEqual(['a', 'b']);
	});

	test('remembers the newest twenty ids', () => {
		const many = Array.from({ length: 25 }, (_, index) => String(index));

		expect(rememberAnnounced(many, [incident('new', 'major')])).toHaveLength(20);
		expect(rememberAnnounced([], [incident('x', 'major')])).toEqual(['x']);
	});
});
