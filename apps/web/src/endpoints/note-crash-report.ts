import { crashNoteResponseSchema, crashNoteSchema } from '@unbound-app/contracts/crash-reports';
import { Type } from '@unbound-app/contracts/schema';
import { eq } from 'drizzle-orm';

import { commentOnCrashIssue } from '~/lib/crash-issues/file-crash-issue';
import { crashNoteComment } from '~/lib/crash-issues/issue-text';
import endpoint, { requireParam } from '~/lib/api/endpoint';
import { ApiError } from '~/lib/api/errors';
import { crashReport } from '~/db/schema';

const noteCrashReportEndpoint = endpoint(
	{ body: crashNoteSchema, query: Type.Undefined(), response: crashNoteResponseSchema },
	async ({ ctx, params, body }) => {
		const id = requireParam(params, 'id');
		const [row] = await ctx.db
			.select({ fingerprint: crashReport.fingerprint })
			.from(crashReport)
			.where(eq(crashReport.id, id));

		if (!row) {
			throw new ApiError('not_found', `Crash report ${id} does not exist.`);
		}

		const comment = crashNoteComment(body.note, id);
		const commented =
			comment && row.fingerprint
				? await commentOnCrashIssue(ctx, row.fingerprint, comment)
				: false;

		return { commented };
	},
	{ rateLimit: { bucket: 'crash-notes', budget: 'CRASH_REPORTS' } },
);

export default noteCrashReportEndpoint;
