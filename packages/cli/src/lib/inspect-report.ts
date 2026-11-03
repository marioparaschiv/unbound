import { Type, type StaticDecode } from '~/lib/schema';

const platformSchema = Type.Enum(['android', 'ios']);

export const classReportSchema = Type.Object({
	platform: platformSchema,
	name: Type.String(),
	superclasses: Type.Array(Type.String()),
	interfaces: Type.Array(Type.String()),
	constructors: Type.Array(Type.Array(Type.String())),
	methods: Type.Array(
		Type.Object({
			name: Type.String(),
			parameters: Type.Array(Type.String()),
			returnType: Type.String(),
			static: Type.Boolean(),
		}),
	),
	fields: Type.Array(
		Type.Object({ name: Type.String(), type: Type.String(), static: Type.Boolean() }),
	),
	members: Type.Boolean(),
});

export const viewRecordSchema = Type.Object({
	depth: Type.Number(),
	className: Type.String(),
	id: Type.Union([Type.String(), Type.Null()]),
	width: Type.Number(),
	height: Type.Number(),
	visibility: Type.Enum(['visible', 'invisible', 'gone', 'hidden']),
	text: Type.Union([Type.String(), Type.Null()]),
	handle: Type.Union([Type.String(), Type.Null()]),
});

export const viewsReportSchema = Type.Object({
	platform: platformSchema,
	roots: Type.Array(Type.Array(viewRecordSchema)),
	visited: Type.Union([Type.Number(), Type.Null()]),
	truncated: Type.Boolean(),
});

/** What `inspectNative` answers with on the device, as `ubd inspect` reads it back. */
export const inspectReportSchema = Type.Union([
	Type.Object({ error: Type.String() }),
	classReportSchema,
	viewsReportSchema,
]);

export type ClassReport = StaticDecode<typeof classReportSchema>;

export type ViewRecord = StaticDecode<typeof viewRecordSchema>;

export type ViewsReport = StaticDecode<typeof viewsReportSchema>;

export type InspectReport = StaticDecode<typeof inspectReportSchema>;

export default { classReportSchema, viewRecordSchema, viewsReportSchema, inspectReportSchema };
