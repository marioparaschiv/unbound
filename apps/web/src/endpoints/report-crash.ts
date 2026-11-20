import { crashReportResponseSchema, crashReportSchema } from '@unbound-app/contracts/crash-reports';
import { Type } from '@unbound-app/contracts/schema';

import { crashOrigin, filesIssue, unfiledReason } from '~/lib/crash-issues/crash-origin';
import { withdrawOnCrashSpike } from '~/lib/crash-issues/crash-withdrawal';
import { fileCrashIssue } from '~/lib/crash-issues/file-crash-issue';
import { crashFingerprint } from '~/lib/crash-issues/fingerprint';
import { crashSpread } from '~/lib/crash-issues/crash-spread';
import { crashReport } from '~/db/schema';
import endpoint from '~/lib/api/endpoint';

const reportCrashEndpoint = endpoint(
	{ body: crashReportSchema, query: Type.Undefined(), response: crashReportResponseSchema },
	async ({ ctx, body }) => {
		const id = Bun.randomUUIDv7();
		const fingerprint = crashFingerprint(body);

		const origin = crashOrigin(body);

		await ctx.db.insert(crashReport).values({
			id,
			kind: body.kind,
			platform: body.platform,
			clientVersion: body.clientVersion,
			loaderVersion: body.loaderVersion,
			discordVersion: body.discordVersion,
			osVersion: body.osVersion,
			deviceModel: body.deviceModel,
			verifiedBuild: body.verifiedBuild ?? null,
			installId: body.installId ?? null,
			addonId: body.addon?.id ?? null,
			addonVersion: body.addon?.version ?? null,
			addonTrust: body.addon?.trust ?? null,
			phase: body.phase ?? null,
			seconds: body.seconds ?? null,
			message: body.message ?? null,
			stack: body.stack ?? null,
			log: body.log ?? null,
			context: body.context ?? null,
			origin,
			fingerprint,
			receivedAt: ctx.now(),
		});

		await withdrawOnCrashSpike(ctx, body);

		const issue = filesIssue(body, origin)
			? await fileCrashIssue(ctx, body, id, fingerprint)
			: undefined;

		const seen = await crashSpread(ctx, fingerprint, body.clientVersion);

		if (issue) {
			return { id, origin, issue, seen };
		}

		return {
			id,
			origin,
			unfiled: unfiledReason(body, origin, Boolean(ctx.env.GITHUB_ISSUES_TOKEN)),
			seen,
		};
	},
	{ rateLimit: { bucket: 'crash-reports', budget: 'CRASH_REPORTS' } },
);

export default reportCrashEndpoint;
