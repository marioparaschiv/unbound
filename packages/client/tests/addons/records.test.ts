import { describe, expect, test } from 'bun:test';

import type { RecordChange } from '~/addons/records';
import { createRecord } from '~/addons/records';
import type { Bucket } from '~/storage/api';

function memoryBucket(): Bucket & { values: Map<string, unknown> } {
	const values = new Map<string, unknown>();

	return {
		values,
		get: (key, def) => (values.has(key) ? values.get(key) : def) as never,
		set: (key, value) => void values.set(key, value),
		toggle: () => undefined,
		remove: (key) => void values.delete(key),
		clear: () => values.clear(),
	};
}

describe('createRecord', () => {
	test('keeps one value per addon under its key and announces each write', () => {
		const bucket = memoryBucket();
		const changes: RecordChange[] = [];
		const held = createRecord<string>(bucket, 'held', (change) => void changes.push(change));

		held.set('a', '1.0.0');
		held.set('b', '2.0.0');

		expect(held.get('a')).toBe('1.0.0');
		expect(bucket.values.get('held')).toEqual({ a: '1.0.0', b: '2.0.0' });

		held.delete('a');

		expect(held.all()).toEqual({ b: '2.0.0' });
		expect(changes).toEqual([
			{ key: 'held', id: 'a' },
			{ key: 'held', id: 'b' },
			{ key: 'held', id: 'a' },
		]);
	});

	test('deleting an addon it has no value for writes and announces nothing', () => {
		const bucket = memoryBucket();
		const changes: RecordChange[] = [];
		const sources = createRecord<string>(
			bucket,
			'sources',
			(change) => void changes.push(change),
		);

		sources.delete('missing');

		expect(bucket.values.has('sources')).toBe(false);
		expect(changes).toEqual([]);
	});

	test('keeps a false value, so a disabled addon stays recorded', () => {
		const states = createRecord<boolean>(memoryBucket(), 'states', () => undefined);

		states.set('a', false);

		expect(states.all()).toEqual({ a: false });
		expect(states.get('a')).toBe(false);
	});
});
