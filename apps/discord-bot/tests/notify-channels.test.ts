import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { parseMemberPayload } from '~/dispatchers/roles';
import { NOTIFY_CHANNELS } from '~/dispatchers/types';
import { MIGRATIONS_FOLDER } from '~/db/migrate';

const NOTIFY = /pg_notify\(\s*'(\w+)'\s*,\s*(?:'(\w+):')?/g;

function migrationSql() {
	return readdirSync(MIGRATIONS_FOLDER, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => readFileSync(join(MIGRATIONS_FOLDER, entry.name, 'migration.sql'), 'utf8'))
		.join('\n');
}

const notifies = [...migrationSql().matchAll(NOTIFY)].map(([, channel = '', subject]) => ({
	channel,
	subject,
}));

describe('the NOTIFY channels in the trigger migrations', () => {
	test('are exactly the channels the dispatchers listen on', () => {
		const channels = new Set(notifies.map((notify) => notify.channel));

		expect([...channels].toSorted()).toEqual([...NOTIFY_CHANNELS].toSorted());
	});

	test('every member_changed payload subject is one the roles dispatcher reads', () => {
		const subjects = notifies
			.filter((notify) => notify.channel === 'member_changed')
			.map((notify) => notify.subject ?? '');

		expect(subjects.length).toBeGreaterThan(0);

		for (const subject of subjects) {
			expect<string | undefined>(parseMemberPayload(`${subject}:1`)?.by).toBe(subject);
		}
	});
});
