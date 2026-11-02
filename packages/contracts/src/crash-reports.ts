import { addonIdSchema, semverSchema } from './manifest';
import { Type, type StaticDecode } from './schema';

export const CRASH_REPORT_KINDS = ['crash', 'freeze', 'start-failure'] as const;

export const CRASH_REPORT_PLATFORMS = ['ios', 'android'] as const;

export const CRASH_REPORT_LOG_LIMIT = 16_000;

/** What the client sends when crash reporting is on: no account, message content or addon settings. */
export const crashReportSchema = Type.Object({
	kind: Type.Enum(CRASH_REPORT_KINDS),
	platform: Type.Enum(CRASH_REPORT_PLATFORMS),
	clientVersion: semverSchema,
	loaderVersion: Type.String({ maxLength: 64 }),
	discordVersion: Type.String({ maxLength: 64 }),
	osVersion: Type.String({ maxLength: 64 }),
	deviceModel: Type.String({ maxLength: 64 }),
	verifiedBuild: Type.Optional(Type.Boolean()),
	addon: Type.Optional(
		Type.Object({
			id: addonIdSchema,
			version: Type.String({ maxLength: 64 }),
			trust: Type.Enum(['signed', 'unsigned']),
		}),
	),
	phase: Type.Optional(Type.Enum(['starting', 'running', 'frozen'])),
	seconds: Type.Optional(Type.Number({ minimum: 0, maximum: 86_400 })),
	message: Type.Optional(Type.String({ maxLength: 2_000 })),
	stack: Type.Optional(Type.String({ maxLength: 16_000 })),
	log: Type.Optional(Type.String({ maxLength: CRASH_REPORT_LOG_LIMIT })),
});

export const crashReportResponseSchema = Type.Object({
	id: Type.String(),
});

export type CrashReport = StaticDecode<typeof crashReportSchema>;

export default {
	CRASH_REPORT_KINDS,
	CRASH_REPORT_PLATFORMS,
	CRASH_REPORT_LOG_LIMIT,
	crashReportSchema,
	crashReportResponseSchema,
};
