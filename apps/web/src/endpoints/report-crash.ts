import { crashReportResponseSchema, crashReportSchema } from '@unbound-app/contracts/crash-reports';
import { getIP } from 'better-auth/api';
import { z } from 'zod';

import { consumeRateLimit } from '~/lib/rate-limit';
import { crashReport } from '~/db/schema';
import endpoint from '~/lib/api/endpoint';

const reportCrashEndpoint = endpoint(
	{ body: crashReportSchema, query: z.undefined(), response: crashReportResponseSchema },
	async ({ ctx, request, body }) => {
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		await consumeRateLimit(ctx, {
			key: `api:crash-reports:${ip}`,
			windowSeconds: ctx.env.CRASH_REPORTS_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.CRASH_REPORTS_RATE_LIMIT_MAX,
		});

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
);

export default reportCrashEndpoint;
