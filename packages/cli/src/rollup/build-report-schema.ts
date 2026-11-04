// From typebox itself: rollup configs load this file under Node, which cannot resolve the contracts' extensionless imports.
import { Type, type StaticDecode } from 'typebox';

const count = Type.Integer({ minimum: 0 });

const counts = Type.Record(Type.String(), count, { additionalProperties: false });

export const reportSectionSchema = Type.Union([
	Type.Literal('inlined'),
	Type.Literal('shipped'),
	Type.Literal('metro'),
]);

/** What one feature plugin adds to the build report. Entries with the same section and label merge into one line. */
export const reportEntrySchema = Type.Object({
	section: reportSectionSchema,
	label: Type.String(),
	/** Show how many entries merged, as `(3 <unit>s)`, or `(3)` for `''`. */
	unit: Type.Optional(Type.String()),
	/** Bytes this entry adds; merged entries sum them. */
	bytes: Type.Optional(count),
	/** Counts this entry under a kind, such as `keyed` or `uncached`. */
	tally: Type.Optional(Type.String()),
	/** Where the entry comes from, such as `src/index.tsx:12`. */
	location: Type.Optional(Type.String()),
	/** Names this entry in the `ubd dev` summary, such as `uncached filter`. */
	issue: Type.Optional(Type.String()),
});

/** One line of a report section: every contribution with the same section and label, merged. */
export const reportGroupSchema = Type.Object({
	label: Type.String(),
	/** When set, the line shows how many contributions it merged, as `(3 <unit>s)`, or `(3)` for `''`. */
	unit: Type.Optional(Type.String()),
	items: count,
	bytes: count,
	/** Contributions counted by kind, such as `{ keyed: 9, uncached: 1 }`. */
	tallies: counts,
	/** Where each located contribution came from, such as `src/index.tsx:12`. */
	locations: Type.Array(Type.String()),
	/** Contributions `ubd dev` names in its one-line summary, counted by noun, such as `uncached filter`. */
	issues: counts,
});

export const budgetNameSchema = Type.Union([Type.Literal('bundle'), Type.Literal('assets')]);

export const reportWarningSchema = Type.Union([
	Type.Object({
		kind: Type.Literal('budget'),
		budget: budgetNameSchema,
		bytes: count,
		limit: count,
	}),
	Type.Object({
		kind: Type.Literal('shim'),
		library: Type.String(),
		modules: Type.Array(Type.String()),
	}),
]);

/** What `ubd build` reports for one plugin, written by the preset's `build-report` plugin. */
export const buildReportSchema = Type.Object({
	name: Type.String(),
	version: Type.String(),
	bundle: Type.Object({
		file: Type.String(),
		bytes: count,
		gzip: count,
		bytecode: Type.Array(Type.Object({ version: Type.Integer(), bytes: count })),
	}),
	inlined: Type.Array(reportGroupSchema),
	shipped: Type.Array(reportGroupSchema),
	metro: Type.Array(reportGroupSchema),
	/** The largest source modules by rendered size, before minification. */
	modules: Type.Array(Type.Object({ id: Type.String(), bytes: count })),
	/** Each budget's limit in bytes. */
	budgets: Type.Object({ bundle: count, assets: count }),
	warnings: Type.Array(reportWarningSchema),
});

export type ReportSection = StaticDecode<typeof reportSectionSchema>;

export type ReportEntry = StaticDecode<typeof reportEntrySchema>;

export type ReportGroup = StaticDecode<typeof reportGroupSchema>;

export type BudgetName = StaticDecode<typeof budgetNameSchema>;

export type ReportWarning = StaticDecode<typeof reportWarningSchema>;

export type BuildReport = StaticDecode<typeof buildReportSchema>;

export default {
	buildReportSchema,
	reportEntrySchema,
	reportGroupSchema,
	reportSectionSchema,
	reportWarningSchema,
	budgetNameSchema,
};
