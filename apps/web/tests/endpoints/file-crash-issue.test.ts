import {
	crashIssueResponseSchema,
	crashReportResponseSchema,
} from '@unbound-app/contracts/crash-reports';
import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';

import fileCrashIssueEndpoint from '~/endpoints/file-crash-issue';
import reportCrashEndpoint from '~/endpoints/report-crash';

import { createTestContext } from '../helpers/context';

type FakeIssueCall = { path: string; title?: string };

const calls: FakeIssueCall[] = [];
let nextIssue = 90;
const github = Bun.serve({
	port: 0,
	async fetch(request) {
		const body = (await request.json()) as { title?: string };

		calls.push({ path: new URL(request.url).pathname, title: body.title });
		nextIssue += 1;

		return Response.json(
			{ number: nextIssue, html_url: `https://github.com/owner/repo/issues/${nextIssue}` },
			{ status: 201 },
		);
	},
});
const base = await createTestContext({
	GITHUB_ISSUES_TOKEN: 'issue-token',
	GITHUB_API_URL: `http://localhost:${github.port}`,
	CRASH_ISSUES_REPOSITORY: 'owner/repo',
});
const ctx = base.ctx;

afterAll(() => {
	github.stop(true);

	return base.close();
});

beforeEach(() => {
	calls.length = 0;
});

const systemCrash: CrashReport = {
	kind: 'native-crash',
	platform: 'ios',
	clientVersion: '1.0.0',
	loaderVersion: '1.0.0',
	discordVersion: '352.1',
	osVersion: '26.0.1',
	deviceModel: 'iPhone12,8',
	message: 'SIGSEGV',
	stack: 'Signal 11\n#0 0x19d839974 libsystem_kernel.dylib + 0x1974 __pthread_kill',
};

let ip = 10;

async function store(report: CrashReport): Promise<string> {
	ip += 1;

	const response = await reportCrashEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/crash-reports', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				[ctx.env.IP_ADDRESS_HEADER]: `203.0.113.${ip}`,
			},
			body: JSON.stringify(report),
		}),
	);

	return parse(crashReportResponseSchema, await response.json()).id;
}

async function requestIssue(id: string) {
	ip += 1;

	return fileCrashIssueEndpoint.handle(
		ctx,
		new Request(new URL(`/api/v1/crash-reports/${id}/issue`, ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers: { [ctx.env.IP_ADDRESS_HEADER]: `203.0.113.${ip}` },
		}),
		{ id },
	);
}

describe('requested crash issues', () => {
	test('files a crash the server kept off GitHub when its user asks', async () => {
		const id = await store(systemCrash);

		expect(calls).toHaveLength(0);

		const answer = parse(crashIssueResponseSchema, await (await requestIssue(id)).json());

		expect(answer.origin).toBe('system');
		expect(answer.issue?.created).toBe(true);
		expect(calls.map(({ path }) => path)).toEqual(['/repos/owner/repo/issues']);
	});

	test('joins the open issue instead of opening another', async () => {
		const id = await store({ ...systemCrash, osVersion: '26.1' });
		const answer = parse(crashIssueResponseSchema, await (await requestIssue(id)).json());

		expect(answer.issue?.created).toBe(false);
		expect(calls).toHaveLength(0);
	});

	test('leaves third-party addon crashes to their authors', async () => {
		const id = await store({
			...systemCrash,
			kind: 'crash',
			stack: 'TypeError: x is undefined',
			addon: { id: 'someone.plugin', version: '1.0.0', trust: 'unsigned' },
		});
		const answer = parse(crashIssueResponseSchema, await (await requestIssue(id)).json());

		expect(answer).toEqual({ origin: 'addon' });
		expect(calls).toHaveLength(0);
	});

	test('answers 404 for an unknown report', async () => {
		expect((await requestIssue('missing')).status).toBe(404);
	});
});
