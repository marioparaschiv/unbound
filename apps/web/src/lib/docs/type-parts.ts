import type {
	DocsLiteral,
	DocsReflection,
	DocsType,
	DocsTypeName,
	DocsTypeVariant,
} from '~/lib/docs/typedoc';
import type { DocsLocation } from '~/lib/docs/docs-index';
import { ReflectionKind } from '~/lib/docs/kinds';

/** One styled token of a rendered type. Only a reference into this project becomes a link. */
export type TypePart =
	| {
			kind: 'keyword' | 'intrinsic' | 'punctuation' | 'name' | 'literal' | 'parameter';
			text: string;
	  }
	| { kind: 'link'; text: string; location: DocsLocation };

export type TypeContext = {
	/** Where a reflection of this project is shown, or `undefined` when it has no page. */
	resolve: (id: number) => DocsLocation | undefined;
};

type Renderers = {
	[K in DocsTypeName]: (type: DocsTypeVariant<K>, ctx: TypeContext) => TypePart[];
};

/** Binding strength: a type below its slot's minimum is parenthesised there. */
const LEVEL_CONDITIONAL = 0;
const LEVEL_UNION = 1;
const LEVEL_INTERSECTION = 2;
const LEVEL_OPERATOR = 3;
const LEVEL_PRIMARY = 4;

const keyword = (text: string): TypePart => ({ kind: 'keyword', text });
const punctuation = (text: string): TypePart => ({ kind: 'punctuation', text });
const name = (text: string): TypePart => ({ kind: 'name', text });

function isFunctionType(type: DocsType): boolean {
	return (
		type.type === 'reflection' &&
		Boolean(type.declaration.signatures?.length) &&
		!type.declaration.children?.length
	);
}

function getLevel(type: DocsType): number {
	if (type.type === 'conditional' || isFunctionType(type)) {
		return LEVEL_CONDITIONAL;
	}

	if (type.type === 'union') {
		return LEVEL_UNION;
	}

	if (type.type === 'intersection') {
		return LEVEL_INTERSECTION;
	}

	if (type.type === 'typeOperator' || type.type === 'query' || type.type === 'predicate') {
		return LEVEL_OPERATOR;
	}

	return LEVEL_PRIMARY;
}

function join(groups: TypePart[][], separator: TypePart[]): TypePart[] {
	return groups.flatMap((group, index) => (index ? [...separator, ...group] : group));
}

function wrap(type: DocsType, ctx: TypeContext, minimum: number): TypePart[] {
	const parts = typeToParts(type, ctx);

	return getLevel(type) < minimum ? [punctuation('('), ...parts, punctuation(')')] : parts;
}

function literalText(value: DocsLiteral): string {
	if (value === null) {
		return 'null';
	}

	if (typeof value === 'object') {
		return `${value.negative ? '-' : ''}${value.value}n`;
	}

	return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function typeArgumentParts(types: DocsType[] | undefined, ctx: TypeContext): TypePart[] {
	if (!types?.length) {
		return [];
	}

	return [
		punctuation('<'),
		...join(
			types.map((type) => typeToParts(type, ctx)),
			[punctuation(', ')],
		),
		punctuation('>'),
	];
}

/**
 * @description Renders a signature's type parameters: `<T extends Base = Default>`.
 * @param typeParameters The type parameters.
 * @param ctx Resolves references to their pages.
 * @returns The parts, empty without type parameters.
 */
export function typeParameterParts(
	typeParameters: DocsReflection[] | undefined,
	ctx: TypeContext,
): TypePart[] {
	if (!typeParameters?.length) {
		return [];
	}

	const each = typeParameters.map((parameter) => [
		name(parameter.name),
		...(parameter.type ? [keyword(' extends '), ...typeToParts(parameter.type, ctx)] : []),
		...(parameter.default ? [punctuation(' = '), ...typeToParts(parameter.default, ctx)] : []),
	]);

	return [punctuation('<'), ...join(each, [punctuation(', ')]), punctuation('>')];
}

function parameterParts(parameter: DocsReflection, ctx: TypeContext): TypePart[] {
	return [
		...(parameter.flags.isRest ? [punctuation('...')] : []),
		{ kind: 'parameter', text: parameter.name },
		punctuation(parameter.flags.isOptional ? '?: ' : ': '),
		...(parameter.type ? typeToParts(parameter.type, ctx) : [keyword('any')]),
	];
}

/**
 * @description Renders a call signature: `<T>(a: A, b?: B) => R`, or `: R` instead of the arrow for a method.
 * @param signature The signature reflection.
 * @param ctx Resolves references to their pages.
 * @param arrow Whether the return type follows `=>` (a function type) or `:` (a declaration).
 * @returns The parts.
 */
export function signatureParts(
	signature: DocsReflection,
	ctx: TypeContext,
	arrow = true,
): TypePart[] {
	const parameters = (signature.parameters ?? []).map((parameter) =>
		parameterParts(parameter, ctx),
	);

	return [
		...typeParameterParts(signature.typeParameters, ctx),
		punctuation('('),
		...join(parameters, [punctuation(', ')]),
		punctuation(arrow ? ') => ' : '): '),
		...(signature.type ? typeToParts(signature.type, ctx) : [keyword('void')]),
	];
}

function memberParts(member: DocsReflection, ctx: TypeContext): TypePart[] {
	const prefix = member.flags.isReadonly ? [keyword('readonly ')] : [];
	const optional = member.flags.isOptional ? '?' : '';

	if (member.kind === ReflectionKind.Method && member.signatures?.length) {
		return join(
			member.signatures.map((signature) => [
				...prefix,
				name(member.name + optional),
				...signatureParts(signature, ctx, false),
			]),
			[punctuation('; ')],
		);
	}

	return [
		...prefix,
		name(member.name),
		punctuation(`${optional}: `),
		...(member.type ? typeToParts(member.type, ctx) : [keyword('any')]),
	];
}

function indexSignatureParts(signature: DocsReflection, ctx: TypeContext): TypePart[] {
	const [key] = signature.parameters ?? [];

	return [
		punctuation('['),
		...(key ? parameterParts(key, ctx) : []),
		punctuation(']: '),
		...(signature.type ? typeToParts(signature.type, ctx) : [keyword('any')]),
	];
}

/**
 * @description Renders an inline object type: a function type as an arrow, anything else as `{ member; … }`.
 * @param declaration The type literal's declaration.
 * @param ctx Resolves references to their pages.
 * @returns The parts.
 */
export function declarationParts(declaration: DocsReflection, ctx: TypeContext): TypePart[] {
	const signatures = declaration.signatures ?? [];
	const children = declaration.children ?? [];
	const indexSignatures = declaration.indexSignatures ?? [];

	const [only] = signatures;

	if (only && signatures.length === 1 && !children.length && !indexSignatures.length) {
		return signatureParts(only, ctx);
	}

	const members = [
		...signatures.map((signature) => signatureParts(signature, ctx, false)),
		...indexSignatures.map((signature) => indexSignatureParts(signature, ctx)),
		...children.map((child) => memberParts(child, ctx)),
	];

	if (!members.length) {
		return [punctuation('{}')];
	}

	return [punctuation('{ '), ...join(members, [punctuation('; ')]), punctuation(' }')];
}

function modifier(value: '+' | '-' | undefined, text: string): TypePart[] {
	if (!value) {
		return [];
	}

	return [keyword(value === '-' ? `-${text}` : text)];
}

/** One renderer per TypeDoc type discriminant; each recurses through {@link typeToParts}. */
const RENDERERS: Renderers = {
	intrinsic: (type) => [{ kind: 'intrinsic', text: type.name }],
	reference: (type, ctx) => {
		const location =
			typeof type.target === 'number' && !type.refersToTypeParameter
				? ctx.resolve(type.target)
				: undefined;
		const head: TypePart = location
			? { kind: 'link', text: type.name, location }
			: name(type.name);

		return [head, ...typeArgumentParts(type.typeArguments, ctx)];
	},
	union: (type, ctx) =>
		join(
			type.types.map((member) => wrap(member, ctx, LEVEL_INTERSECTION)),
			[punctuation(' | ')],
		),
	intersection: (type, ctx) =>
		join(
			type.types.map((member) => wrap(member, ctx, LEVEL_OPERATOR)),
			[punctuation(' & ')],
		),
	array: (type, ctx) => [...wrap(type.elementType, ctx, LEVEL_PRIMARY), punctuation('[]')],
	literal: (type) => [{ kind: 'literal', text: literalText(type.value) }],
	reflection: (type, ctx) => declarationParts(type.declaration, ctx),
	tuple: (type, ctx) => [
		punctuation('['),
		...join(
			(type.elements ?? []).map((element) => typeToParts(element, ctx)),
			[punctuation(', ')],
		),
		punctuation(']'),
	],
	typeOperator: (type, ctx) => [
		keyword(`${type.operator} `),
		...wrap(type.target, ctx, LEVEL_OPERATOR),
	],
	indexedAccess: (type, ctx) => [
		...wrap(type.objectType, ctx, LEVEL_PRIMARY),
		punctuation('['),
		...typeToParts(type.indexType, ctx),
		punctuation(']'),
	],
	conditional: (type, ctx) => [
		...wrap(type.checkType, ctx, LEVEL_UNION),
		keyword(' extends '),
		...wrap(type.extendsType, ctx, LEVEL_UNION),
		punctuation(' ? '),
		...typeToParts(type.trueType, ctx),
		punctuation(' : '),
		...typeToParts(type.falseType, ctx),
	],
	query: (type, ctx) => [keyword('typeof '), ...typeToParts(type.queryType, ctx)],
	predicate: (type, ctx) => [
		...(type.asserts ? [keyword('asserts ')] : []),
		{ kind: 'parameter', text: type.name },
		...(type.targetType ? [keyword(' is '), ...typeToParts(type.targetType, ctx)] : []),
	],
	templateLiteral: (type, ctx) => [
		{ kind: 'literal', text: `\`${type.head}` },
		...type.tail.flatMap(([inner, text]): TypePart[] => [
			punctuation('${'),
			...typeToParts(inner, ctx),
			punctuation('}'),
			{ kind: 'literal', text },
		]),
		{ kind: 'literal', text: '`' },
	],
	mapped: (type, ctx) => [
		punctuation('{ '),
		...modifier(type.readonlyModifier, 'readonly '),
		punctuation('['),
		{ kind: 'parameter', text: type.parameter },
		keyword(' in '),
		...typeToParts(type.parameterType, ctx),
		...(type.nameType ? [keyword(' as '), ...typeToParts(type.nameType, ctx)] : []),
		punctuation(']'),
		...modifier(type.optionalModifier, '?'),
		punctuation(': '),
		...typeToParts(type.templateType, ctx),
		punctuation(' }'),
	],
	namedTupleMember: (type, ctx) => [
		{ kind: 'parameter', text: type.name },
		punctuation(type.isOptional ? '?: ' : ': '),
		...typeToParts(type.element, ctx),
	],
	optional: (type, ctx) => [...wrap(type.elementType, ctx, LEVEL_PRIMARY), punctuation('?')],
	rest: (type, ctx) => [punctuation('...'), ...wrap(type.elementType, ctx, LEVEL_PRIMARY)],
	inferred: (type, ctx) => [
		keyword('infer '),
		name(type.name),
		...(type.constraint ? [keyword(' extends '), ...typeToParts(type.constraint, ctx)] : []),
	],
	unknown: (type) => [name(type.name)],
};

/**
 * @description Renders a TypeDoc type as styled parts, recursing through the renderer of each nested type's discriminant.
 * @param type The type.
 * @param ctx Resolves references to their pages.
 * @returns The parts, in reading order.
 */
export function typeToParts(type: DocsType, ctx: TypeContext): TypePart[] {
	// `type.type` keys the registry, so the entry it picks takes exactly this variant.
	const render = RENDERERS[type.type] as (type: DocsType, ctx: TypeContext) => TypePart[];

	return render(type, ctx);
}

/**
 * @description Joins parts back into plain text, for search and accessible labels.
 * @param parts The parts.
 * @returns The text.
 */
export function partsToText(parts: TypePart[]): string {
	return parts.map((part) => part.text).join('');
}

export default {
	typeToParts,
	typeParameterParts,
	signatureParts,
	declarationParts,
	partsToText,
};
