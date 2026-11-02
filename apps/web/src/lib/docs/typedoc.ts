import { Type } from '@unbound-app/contracts/schema';

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

const symbolIdSchema = Type.Object({ packageName: Type.String(), qualifiedName: Type.String() });

const commentPartSchema = Type.Union([
	Type.Object({ kind: Type.Enum(['text', 'code']), text: Type.String() }),
	Type.Object({
		kind: Type.Literal('inline-tag'),
		tag: Type.String(),
		text: Type.String(),
		target: Type.Optional(Type.Union([Type.Number(), Type.String(), symbolIdSchema])),
	}),
	Type.Object({ kind: Type.Literal('relative-link'), text: Type.String() }),
]);

const commentSchema = Type.Object({
	summary: Type.Array(commentPartSchema),
	blockTags: Type.Optional(
		Type.Array(
			Type.Object({
				tag: Type.String(),
				name: Type.Optional(Type.String()),
				content: Type.Array(commentPartSchema),
			}),
		),
	),
	modifierTags: Type.Optional(Type.Array(Type.String())),
});

const literalSchema = Type.Union([
	Type.String(),
	Type.Number(),
	Type.Boolean(),
	Type.Null(),
	Type.Object({ value: Type.String(), negative: Type.Boolean() }),
]);

const modifierSchema = Type.Optional(Type.Enum(['+', '-']));

const docsType = Type.Ref('DocsType');
const docsReflection = Type.Ref('DocsReflection');

// Types and reflections nest in each other, so both live in one module and refer to each other by name.
const docs = Type.Module({
	DocsType: Type.Union([
		Type.Object({ type: Type.Literal('intrinsic'), name: Type.String() }),
		Type.Object({
			type: Type.Literal('reference'),
			name: Type.String(),
			target: Type.Union([Type.Number(), symbolIdSchema]),
			typeArguments: Type.Optional(Type.Array(docsType)),
			package: Type.Optional(Type.String()),
			externalUrl: Type.Optional(Type.String()),
			refersToTypeParameter: Type.Optional(Type.Boolean()),
		}),
		Type.Object({ type: Type.Literal('union'), types: Type.Array(docsType) }),
		Type.Object({ type: Type.Literal('intersection'), types: Type.Array(docsType) }),
		Type.Object({ type: Type.Literal('array'), elementType: docsType }),
		Type.Object({ type: Type.Literal('literal'), value: literalSchema }),
		Type.Object({ type: Type.Literal('reflection'), declaration: docsReflection }),
		Type.Object({ type: Type.Literal('tuple'), elements: Type.Optional(Type.Array(docsType)) }),
		Type.Object({
			type: Type.Literal('typeOperator'),
			operator: Type.String(),
			target: docsType,
		}),
		Type.Object({
			type: Type.Literal('indexedAccess'),
			objectType: docsType,
			indexType: docsType,
		}),
		Type.Object({
			type: Type.Literal('conditional'),
			checkType: docsType,
			extendsType: docsType,
			trueType: docsType,
			falseType: docsType,
		}),
		Type.Object({ type: Type.Literal('query'), queryType: docsType }),
		Type.Object({
			type: Type.Literal('predicate'),
			name: Type.String(),
			asserts: Type.Boolean(),
			targetType: Type.Optional(docsType),
		}),
		Type.Object({
			type: Type.Literal('templateLiteral'),
			head: Type.String(),
			tail: Type.Array(Type.Tuple([docsType, Type.String()])),
		}),
		Type.Object({
			type: Type.Literal('mapped'),
			parameter: Type.String(),
			parameterType: docsType,
			templateType: docsType,
			readonlyModifier: modifierSchema,
			optionalModifier: modifierSchema,
			nameType: Type.Optional(docsType),
		}),
		Type.Object({
			type: Type.Literal('namedTupleMember'),
			name: Type.String(),
			isOptional: Type.Boolean(),
			element: docsType,
		}),
		Type.Object({ type: Type.Literal('optional'), elementType: docsType }),
		Type.Object({ type: Type.Literal('rest'), elementType: docsType }),
		Type.Object({
			type: Type.Literal('inferred'),
			name: Type.String(),
			constraint: Type.Optional(docsType),
		}),
		Type.Object({ type: Type.Literal('unknown'), name: Type.String() }),
	]),
	DocsReflection: Type.Object({
		id: Type.Number(),
		name: Type.String(),
		kind: Type.Number(),
		variant: Type.String(),
		flags: Type.Record(Type.String(), Type.Boolean()),
		comment: Type.Optional(commentSchema),
		children: Type.Optional(Type.Array(docsReflection)),
		signatures: Type.Optional(Type.Array(docsReflection)),
		indexSignatures: Type.Optional(Type.Array(docsReflection)),
		getSignature: Type.Optional(docsReflection),
		setSignature: Type.Optional(docsReflection),
		parameters: Type.Optional(Type.Array(docsReflection)),
		typeParameters: Type.Optional(Type.Array(docsReflection)),
		type: Type.Optional(docsType),
		default: Type.Optional(docsType),
		defaultValue: Type.Optional(Type.String()),
		target: Type.Optional(Type.Number()),
		extendedTypes: Type.Optional(Type.Array(docsType)),
		inheritedFrom: Type.Optional(docsType),
	}),
	DocsProject: Type.Object({
		schemaVersion: Type.String(),
		name: Type.String(),
		children: Type.Array(docsReflection),
	}),
});

export const docsTypeSchema = Type.Unsafe<DocsType>(docs.DocsType);
export const docsReflectionSchema = Type.Unsafe<DocsReflection>(docs.DocsReflection);
export const docsProjectSchema = Type.Unsafe<DocsProject>(docs.DocsProject);

export default { docsTypeSchema, docsReflectionSchema, docsProjectSchema };
