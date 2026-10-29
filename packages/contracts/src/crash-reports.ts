import { addonIdSchema, semverSchema } from './manifest';
import { z } from './zod';

export const CRASH_REPORT_KINDS = ['crash', 'freeze', 'start-failure'] as const;

export const CRASH_REPORT_PLATFORMS = ['ios', 'android'] as const;

export const CRASH_REPORT_LOG_LIMIT = 16_000;

/** What the client sends when crash reporting is on: no account, message content or addon settings. */
export const crashReportSchema = z.object({
	kind: z.enum(CRASH_REPORT_KINDS),
	platform: z.enum(CRASH_REPORT_PLATFORMS),
	clientVersion: semverSchema,
	loaderVersion: z.string().check(z.maxLength(64)),
	discordVersion: z.string().check(z.maxLength(64)),
	osVersion: z.string().check(z.maxLength(64)),
	deviceModel: z.string().check(z.maxLength(64)),
	verifiedBuild: z.optional(z.boolean()),
	addon: z.optional(
		z.object({
			id: addonIdSchema,
			version: z.string().check(z.maxLength(64)),
			trust: z.enum(['signed', 'unsigned']),
		}),
	),
	phase: z.optional(z.enum(['starting', 'running', 'frozen'])),
	seconds: z.optional(z.number().check(z.nonnegative(), z.lte(86_400))),
	message: z.optional(z.string().check(z.maxLength(2_000))),
	stack: z.optional(z.string().check(z.maxLength(16_000))),
	log: z.optional(z.string().check(z.maxLength(CRASH_REPORT_LOG_LIMIT))),
});

export const crashReportResponseSchema = z.object({
	id: z.string(),
});

export type CrashReport = z.infer<typeof crashReportSchema>;

export default {
	CRASH_REPORT_KINDS,
	CRASH_REPORT_PLATFORMS,
	CRASH_REPORT_LOG_LIMIT,
	crashReportSchema,
	crashReportResponseSchema,
};
