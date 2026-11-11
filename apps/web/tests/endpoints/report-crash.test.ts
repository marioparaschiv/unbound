import { crashReportResponseSchema } from '@unbound-app/contracts/crash-reports';
import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { afterAll, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';
import { eq } from 'drizzle-orm';

import reportCrashEndpoint from '~/endpoints/report-crash';
import { crashReport } from '~/db/schema';

import { createTestContext } from '../helpers/context';

const base = await createTestContext({ CRASH_REPORTS_RATE_LIMIT_MAX: '3' });
const ctx = base.ctx;

afterAll(base.close);

const report: CrashReport = {
	kind: 'freeze',
	platform: 'ios',
	clientVersion: '1.0.0',
	loaderVersion: '1.0.0',
	discordVersion: '350.0',
	osVersion: '26.0.1',
	deviceModel: 'iPhone12,8',
	addon: { id: 'unbound.example', version: '1.2.3', trust: 'signed' },
	phase: 'frozen',
	seconds: 9.5,
};

type SentReport = Omit<CrashReport, 'kind'> & { kind: string };

function send(body: SentReport, ip: string) {
	return reportCrashEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/crash-reports', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers: { 'content-type': 'application/json', [ctx.env.IP_ADDRESS_HEADER]: ip },
			body: JSON.stringify(body),
		}),
	);
}

describe('crash reports', () => {
	test('stores a report and answers its id', async () => {
		const response = await send(report, '203.0.113.10');

		expect(response.status).toBe(200);

		const { id } = parse(crashReportResponseSchema, await response.json());
		const [stored] = await ctx.db.select().from(crashReport).where(eq(crashReport.id, id));

		expect(stored?.kind).toBe('freeze');
		expect(stored?.addonId).toBe('unbound.example');
		expect(stored?.addonTrust).toBe('signed');
		expect(stored?.seconds).toBe(9.5);
		expect(stored?.message).toBeNull();
		expect(stored?.log).toBeNull();
	});

	test('stores the log lines a report carries', async () => {
		const log = '2026-10-27T21:00:00.000Z E [plugins] Failed to start addon unbound.example';
		const response = await send({ ...report, log }, '203.0.113.13');

		expect(response.status).toBe(200);

		const { id } = parse(crashReportResponseSchema, await response.json());
		const [stored] = await ctx.db.select().from(crashReport).where(eq(crashReport.id, id));

		expect(stored?.log).toBe(log);
	});

	test('refuses malformed and oversized reports', async () => {
		const invalid = await send({ ...report, kind: 'other' }, '203.0.113.11');

		expect(invalid.status).toBe(400);
		expect(parse(apiErrorResponseSchema, await invalid.json()).error.code).toBeString();

		const oversized = await send({ ...report, stack: 'x'.repeat(16_001) }, '203.0.113.11');

		expect(oversized.status).toBe(400);

		const longLog = await send({ ...report, log: 'x'.repeat(16_001) }, '203.0.113.11');

		expect(longLog.status).toBe(400);
	});

	test('limits how often one address can report', async () => {
		const statuses: number[] = [];

		for (let index = 0; index < 4; index++) {
			statuses.push((await send(report, '203.0.113.12')).status);
		}

		expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
		expect(statuses[3]).toBe(429);
	});
});
