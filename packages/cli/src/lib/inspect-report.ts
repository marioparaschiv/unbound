import { z } from 'zod';

const platformSchema = z.enum(['android', 'ios']);

export const classReportSchema = z.object({
	platform: platformSchema,
	name: z.string(),
	superclasses: z.array(z.string()),
	interfaces: z.array(z.string()),
	constructors: z.array(z.array(z.string())),
	methods: z.array(
		z.object({
			name: z.string(),
			parameters: z.array(z.string()),
			returnType: z.string(),
			static: z.boolean(),
		}),
	),
	fields: z.array(z.object({ name: z.string(), type: z.string(), static: z.boolean() })),
	members: z.boolean(),
});

export const viewRecordSchema = z.object({
	depth: z.number(),
	className: z.string(),
	id: z.string().nullable(),
	width: z.number(),
	height: z.number(),
	visibility: z.enum(['visible', 'invisible', 'gone', 'hidden']),
	text: z.string().nullable(),
	handle: z.string().nullable(),
});

export const viewsReportSchema = z.object({
	platform: platformSchema,
	roots: z.array(z.array(viewRecordSchema)),
	visited: z.number().nullable(),
	truncated: z.boolean(),
});

/** What `inspectNative` answers with on the device, as `ubd inspect` reads it back. */
export const inspectReportSchema = z.union([
	z.object({ error: z.string() }),
	classReportSchema,
	viewsReportSchema,
]);

export type ClassReport = z.infer<typeof classReportSchema>;

export type ViewRecord = z.infer<typeof viewRecordSchema>;

export type ViewsReport = z.infer<typeof viewsReportSchema>;

export type InspectReport = z.infer<typeof inspectReportSchema>;

export default { classReportSchema, viewRecordSchema, viewsReportSchema, inspectReportSchema };
