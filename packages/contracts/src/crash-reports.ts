import { CRASH_CONTEXT_LIMITS, CRASH_REPORT_LOG_LIMIT } from './crash-report-limits';
import { addonIdSchema, semverSchema } from './manifest';
import { Type, type StaticDecode } from './schema';

export { CRASH_CONTEXT_LIMITS, CRASH_REPORT_LOG_LIMIT } from './crash-report-limits';

export const CRASH_REPORT_KINDS = ['crash', 'freeze', 'start-failure', 'native-crash'] as const;

export const CRASH_REPORT_PLATFORMS = ['ios', 'android'] as const;

export const CRASH_ORIGINS = ['unbound', 'addon', 'discord', 'system'] as const;

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
	installId: Type.Optional(Type.String({ pattern: '^[0-9a-f]{16,64}$' })),
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
	context: Type.Optional(
		Type.Object({
			discordBuild: Type.Optional(Type.String({ maxLength: 32 })),
			installSource: Type.Optional(Type.String({ maxLength: 120 })),
			injected: Type.Optional(
				Type.Array(Type.String({ maxLength: 120 }), {
					maxItems: CRASH_CONTEXT_LIMITS.injected,
				}),
			),
			addons: Type.Optional(
				Type.Array(Type.String({ maxLength: 160 }), {
					maxItems: CRASH_CONTEXT_LIMITS.addons,
				}),
			),
			breadcrumbs: Type.Optional(
				Type.Array(Type.String({ maxLength: 240 }), {
					maxItems: CRASH_CONTEXT_LIMITS.breadcrumbs,
				}),
			),
			repeats: Type.Optional(Type.Integer({ minimum: 2, maximum: 1_000 })),
			route: Type.Optional(Type.String({ maxLength: 120 })),
		}),
	),
});

export const crashReportResponseSchema = Type.Object({
	id: Type.String(),
	origin: Type.Optional(Type.Enum(CRASH_ORIGINS)),
	/** The GitHub issue that tracks this crash, when the server files crash reports there. */
	issue: Type.Optional(
		Type.Object({
			number: Type.Integer(),
			url: Type.String(),
			/** Whether this report opened the issue, rather than joining one opened before. */
			created: Type.Boolean(),
		}),
	),
	/** How many installs reported this same crash, in all and on this report's client version. */
	seen: Type.Optional(
		Type.Object({
			installs: Type.Integer({ minimum: 0 }),
			versionInstalls: Type.Integer({ minimum: 0 }),
		}),
	),
});

export const crashIssueResponseSchema = Type.Object({
	origin: Type.Enum(CRASH_ORIGINS),
	issue: Type.Optional(
		Type.Object({ number: Type.Integer(), url: Type.String(), created: Type.Boolean() }),
	),
});

export const crashNoteSchema = Type.Object({
	note: Type.String({ minLength: 1, maxLength: 2_000 }),
});

export const crashNoteResponseSchema = Type.Object({ commented: Type.Boolean() });

export type CrashReport = StaticDecode<typeof crashReportSchema>;

export type CrashContext = NonNullable<CrashReport['context']>;

export type CrashOrigin = (typeof CRASH_ORIGINS)[number];

export default {
	CRASH_REPORT_KINDS,
	CRASH_REPORT_PLATFORMS,
	CRASH_ORIGINS,
	CRASH_REPORT_LOG_LIMIT,
	crashReportSchema,
	crashReportResponseSchema,
	crashIssueResponseSchema,
	crashNoteSchema,
	crashNoteResponseSchema,
};
