import {
	crashNoteResponseSchema,
	crashReportResponseSchema,
} from '@unbound-app/contracts/crash-reports';
import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { afterAll, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';

import noteCrashReportEndpoint from '~/endpoints/note-crash-report';
import reportCrashEndpoint from '~/endpoints/report-crash';

import { createTestContext } from '../helpers/context';

const comments: { path: string; body?: string }[] = [];
const github = Bun.serve({
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname;
		const body = (await request.json()) as { body?: string };

		comments.push({ path, body: body.body });

		return Response.json(
			path.endsWith('/comments')
				? { id: 1 }
				: { number: 42, html_url: 'https://github.com/o/r/issues/42' },
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

const report: CrashReport = {
	kind: 'native-crash',
	platform: 'ios',
	clientVersion: '1.0.0',
	loaderVersion: '1.0.0',
	discordVersion: '352.1',
	osVersion: '26.0.1',
	deviceModel: 'iPhone12,8',
	stack: 'Signal 11\n#0 0x1 Unbound.dylib + 0x10',
};

function post(
	endpoint: typeof reportCrashEndpoint | typeof noteCrashReportEndpoint,
	path: string,
	body: CrashReport | { note: string },
	params?: Record<string, string>,
) {
	return endpoint.handle(
		ctx,
		new Request(new URL(path, ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				[ctx.env.IP_ADDRESS_HEADER]: '203.0.113.50',
			},
			body: JSON.stringify(body),
		}),
		params,
	);
}

describe('crash notes', () => {
	test('comment on the crash issue with the note quoted', async () => {
		const { id } = parse(
			crashReportResponseSchema,
			await (await post(reportCrashEndpoint, '/api/v1/crash-reports', report)).json(),
		);
		const answer = parse(
			crashNoteResponseSchema,
			await (
				await post(
					noteCrashReportEndpoint,
					`/api/v1/crash-reports/${id}/note`,
					{ note: 'Opened a forum post' },
					{ id },
				)
			).json(),
		);

		expect(answer).toEqual({ commented: true });
		expect(comments.at(-1)).toEqual({
			path: '/repos/owner/repo/issues/42/comments',
			body: `A reporter added a note to report \`${id}\`:\n\n> Opened a forum post`,
		});
	});

	test('answer 404 for an unknown report', async () => {
		expect(
			(
				await post(
					noteCrashReportEndpoint,
					'/api/v1/crash-reports/missing/note',
					{ note: 'x' },
					{ id: 'missing' },
				)
			).status,
		).toBe(404);
	});
});
