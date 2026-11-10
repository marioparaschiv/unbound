import { Type, type Static } from '@unbound-app/contracts/schema';

const lagSchema = Type.Object({
	max: Type.Number(),
	blocked: Type.Number(),
	over50: Type.Number(),
	over100: Type.Number(),
	ticks: Type.Number(),
});

const windowSchema = Type.Object({
	name: Type.String(),
	startEpoch: Type.Number(),
	endEpoch: Type.Number(),
	modules: Type.Array(Type.Tuple([Type.String(), Type.Number()])),
	discordModules: Type.Union([Type.Number(), Type.Null()]),
	heap: Type.Union([Type.Record(Type.String(), Type.Number()), Type.Null()]),
	lag: lagSchema,
	error: Type.Optional(Type.String()),
	route: Type.Optional(Type.String()),
});

/** What the agent POSTs at `idle` and `final`; only `final` carries errors and Discord's marks. */
export const agentReportSchema = Type.Object({
	phase: Type.String(),
	variant: Type.String(),
	epoch0: Type.Number(),
	marks: Type.Record(Type.String(), Type.Number()),
	windows: Type.Array(windowSchema),
	errors: Type.Optional(Type.Array(Type.String())),
	discord: Type.Optional(Type.Record(Type.String(), Type.Number())),
	hasGc: Type.Optional(Type.Boolean()),
	/** Each timed piece of work as `[name, start epoch, end epoch]`: client module bodies, Discord module factories, metro finds, `benchSpan`s. */
	spans: Type.Optional(Type.Array(Type.Tuple([Type.String(), Type.Number(), Type.Number()]))),
	/** Summed `[ms, calls]` of frequent work, such as testing each initialized module against waiting filters. */
	totals: Type.Optional(Type.Record(Type.String(), Type.Tuple([Type.Number(), Type.Number()]))),
});

/** One agent report. */
export type AgentReport = Static<typeof agentReportSchema>;
