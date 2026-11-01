import { z } from 'zod';

/** Where an `{@link}` or reference points outside this project. */
export type DocsSymbolId = {
	packageName: string;
	qualifiedName: string;
};

/** An inline tag such as `{@link target}`; a numeric target is a reflection id in this project. */
export type DocsInlineTag = {
	kind: 'inline-tag';
	tag: string;
	text: string;
	target?: number | string | DocsSymbolId;
};

export type DocsCommentPart =
	| { kind: 'text' | 'code'; text: string }
	| DocsInlineTag
	| { kind: 'relative-link'; text: string };

export type DocsCommentTag = {
	tag: string;
	name?: string;
	content: DocsCommentPart[];
};

export type DocsComment = {
	summary: DocsCommentPart[];
	blockTags?: DocsCommentTag[];
	modifierTags?: string[];
};

export type DocsFlags = Partial<
	Record<'isOptional' | 'isRest' | 'isReadonly' | 'isConst' | 'isStatic' | 'isAbstract', boolean>
>;

export type DocsReflection = {
	id: number;
	name: string;
	kind: number;
	variant: string;
	flags: DocsFlags;
	comment?: DocsComment;
	children?: DocsReflection[];
	signatures?: DocsReflection[];
	indexSignatures?: DocsReflection[];
	getSignature?: DocsReflection;
	setSignature?: DocsReflection;
	parameters?: DocsReflection[];
	typeParameters?: DocsReflection[];
	type?: DocsType;
	/** A type parameter's default. */
	default?: DocsType;
	defaultValue?: string;
	/** A re-export's original declaration. */
	target?: number;
	extendedTypes?: DocsType[];
	/** The member of a parent type an inherited member comes from. */
	inheritedFrom?: DocsType;
};

export type DocsProject = {
	schemaVersion: string;
	name: string;
	children: DocsReflection[];
};

export type DocsType =
	| { type: 'intrinsic'; name: string }
	| {
			type: 'reference';
			name: string;
			target: number | DocsSymbolId;
			typeArguments?: DocsType[];
			package?: string;
			externalUrl?: string;
			refersToTypeParameter?: boolean;
	  }
	| { type: 'union'; types: DocsType[] }
	| { type: 'intersection'; types: DocsType[] }
	| { type: 'array'; elementType: DocsType }
	| { type: 'literal'; value: DocsLiteral }
	| { type: 'reflection'; declaration: DocsReflection }
	| { type: 'tuple'; elements?: DocsType[] }
	| { type: 'typeOperator'; operator: string; target: DocsType }
	| { type: 'indexedAccess'; objectType: DocsType; indexType: DocsType }
	| {
			type: 'conditional';
			checkType: DocsType;
			extendsType: DocsType;
			trueType: DocsType;
			falseType: DocsType;
	  }
	| { type: 'query'; queryType: DocsType }
	| { type: 'predicate'; name: string; asserts: boolean; targetType?: DocsType }
	| { type: 'templateLiteral'; head: string; tail: [DocsType, string][] }
	| {
			type: 'mapped';
			parameter: string;
			parameterType: DocsType;
			templateType: DocsType;
			readonlyModifier?: '+' | '-';
			optionalModifier?: '+' | '-';
			nameType?: DocsType;
	  }
	| { type: 'namedTupleMember'; name: string; isOptional: boolean; element: DocsType }
	| { type: 'optional'; elementType: DocsType }
	| { type: 'rest'; elementType: DocsType }
	| { type: 'inferred'; name: string; constraint?: DocsType }
	| { type: 'unknown'; name: string };

/** A bigint literal is serialized as its digits and sign. */
export type DocsLiteral = string | number | boolean | null | { value: string; negative: boolean };

export type DocsTypeName = DocsType['type'];

/** The one variant of {@link DocsType} a discriminant names. */
export type DocsTypeVariant<K extends DocsTypeName> = Extract<DocsType, Record<'type', K>>;

const symbolIdSchema = z.object({ packageName: z.string(), qualifiedName: z.string() });

const commentPartSchema: z.ZodType<DocsCommentPart> = z.discriminatedUnion('kind', [
	z.object({ kind: z.enum(['text', 'code']), text: z.string() }),
	z.object({
		kind: z.literal('inline-tag'),
		tag: z.string(),
		text: z.string(),
		target: z.union([z.number(), z.string(), symbolIdSchema]).optional(),
	}),
	z.object({ kind: z.literal('relative-link'), text: z.string() }),
]);

const commentSchema: z.ZodType<DocsComment> = z.object({
	summary: z.array(commentPartSchema),
	blockTags: z
		.array(
			z.object({
				tag: z.string(),
				name: z.string().optional(),
				content: z.array(commentPartSchema),
			}),
		)
		.optional(),
	modifierTags: z.array(z.string()).optional(),
});

const literalSchema: z.ZodType<DocsLiteral> = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.null(),
	z.object({ value: z.string(), negative: z.boolean() }),
]);

const modifierSchema = z.enum(['+', '-']).optional();

export const docsTypeSchema: z.ZodType<DocsType> = z.lazy(() =>
	z.discriminatedUnion('type', [
		z.object({ type: z.literal('intrinsic'), name: z.string() }),
		z.object({
			type: z.literal('reference'),
			name: z.string(),
			target: z.union([z.number(), symbolIdSchema]),
			typeArguments: z.array(docsTypeSchema).optional(),
			package: z.string().optional(),
			externalUrl: z.string().optional(),
			refersToTypeParameter: z.boolean().optional(),
		}),
		z.object({ type: z.literal('union'), types: z.array(docsTypeSchema) }),
		z.object({ type: z.literal('intersection'), types: z.array(docsTypeSchema) }),
		z.object({ type: z.literal('array'), elementType: docsTypeSchema }),
		z.object({ type: z.literal('literal'), value: literalSchema }),
		z.object({ type: z.literal('reflection'), declaration: docsReflectionSchema }),
		z.object({ type: z.literal('tuple'), elements: z.array(docsTypeSchema).optional() }),
		z.object({ type: z.literal('typeOperator'), operator: z.string(), target: docsTypeSchema }),
		z.object({
			type: z.literal('indexedAccess'),
			objectType: docsTypeSchema,
			indexType: docsTypeSchema,
		}),
		z.object({
			type: z.literal('conditional'),
			checkType: docsTypeSchema,
			extendsType: docsTypeSchema,
			trueType: docsTypeSchema,
			falseType: docsTypeSchema,
		}),
		z.object({ type: z.literal('query'), queryType: docsTypeSchema }),
		z.object({
			type: z.literal('predicate'),
			name: z.string(),
			asserts: z.boolean(),
			targetType: docsTypeSchema.optional(),
		}),
		z.object({
			type: z.literal('templateLiteral'),
			head: z.string(),
			tail: z.array(z.tuple([docsTypeSchema, z.string()])),
		}),
		z.object({
			type: z.literal('mapped'),
			parameter: z.string(),
			parameterType: docsTypeSchema,
			templateType: docsTypeSchema,
			readonlyModifier: modifierSchema,
			optionalModifier: modifierSchema,
			nameType: docsTypeSchema.optional(),
		}),
		z.object({
			type: z.literal('namedTupleMember'),
			name: z.string(),
			isOptional: z.boolean(),
			element: docsTypeSchema,
		}),
		z.object({ type: z.literal('optional'), elementType: docsTypeSchema }),
		z.object({ type: z.literal('rest'), elementType: docsTypeSchema }),
		z.object({
			type: z.literal('inferred'),
			name: z.string(),
			constraint: docsTypeSchema.optional(),
		}),
		z.object({ type: z.literal('unknown'), name: z.string() }),
	]),
);

export const docsReflectionSchema: z.ZodType<DocsReflection> = z.lazy(() =>
	z.object({
		id: z.number(),
		name: z.string(),
		kind: z.number(),
		variant: z.string(),
		flags: z.record(z.string(), z.boolean()),
		comment: commentSchema.optional(),
		children: z.array(docsReflectionSchema).optional(),
		signatures: z.array(docsReflectionSchema).optional(),
		indexSignatures: z.array(docsReflectionSchema).optional(),
		getSignature: docsReflectionSchema.optional(),
		setSignature: docsReflectionSchema.optional(),
		parameters: z.array(docsReflectionSchema).optional(),
		typeParameters: z.array(docsReflectionSchema).optional(),
		type: docsTypeSchema.optional(),
		default: docsTypeSchema.optional(),
		defaultValue: z.string().optional(),
		target: z.number().optional(),
		extendedTypes: z.array(docsTypeSchema).optional(),
		inheritedFrom: docsTypeSchema.optional(),
	}),
);

export const docsProjectSchema: z.ZodType<DocsProject> = z.object({
	schemaVersion: z.string(),
	name: z.string(),
	children: z.array(docsReflectionSchema),
});

export default { docsTypeSchema, docsReflectionSchema, docsProjectSchema };
