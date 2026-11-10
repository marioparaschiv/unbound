import { crashReportResponseSchema, crashReportSchema } from '@unbound-app/contracts/crash-reports';
import { Type } from '@unbound-app/contracts/schema';

import { crashReport } from '~/db/schema';
import endpoint from '~/lib/api/endpoint';

const reportCrashEndpoint = endpoint(
	{ body: crashReportSchema, query: Type.Undefined(), response: crashReportResponseSchema },
	async ({ ctx, body }) => {
		const id = Bun.randomUUIDv7();

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
			addonId: body.addon?.id ?? null,
			addonVersion: body.addon?.version ?? null,
			addonTrust: body.addon?.trust ?? null,
			phase: body.phase ?? null,
			seconds: body.seconds ?? null,
			message: body.message ?? null,
			stack: body.stack ?? null,
			log: body.log ?? null,
			receivedAt: ctx.now(),
		});

		return { id };
	},
	{ rateLimit: { bucket: 'crash-reports', budget: 'CRASH_REPORTS' } },
);

export default reportCrashEndpoint;
