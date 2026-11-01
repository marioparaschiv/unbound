import {
	signatureParts,
	typeParameterParts,
	typeToParts,
	type TypeContext,
	type TypePart,
} from '~/lib/docs/type-parts';
import { isCallableVariable, ReflectionKind } from '~/lib/docs/kinds';
import type { DocsReflection, DocsType } from '~/lib/docs/typedoc';

/** What a declaration header starts with, per kind; kinds outside it show no keyword. */
const DECLARATION_KEYWORDS: Partial<Record<number, string>> = {
	[ReflectionKind.Module]: 'namespace',
	[ReflectionKind.Namespace]: 'namespace',
	[ReflectionKind.Class]: 'class',
	[ReflectionKind.Interface]: 'interface',
	[ReflectionKind.Enum]: 'enum',
	[ReflectionKind.TypeAlias]: 'type',
	[ReflectionKind.Variable]: 'const',
};

const HEADER_ONLY_KINDS = new Set<number>([ReflectionKind.Class, ReflectionKind.Interface]);

/** The kinds whose own children are members rather than pages. */
const OBJECT_KINDS = new Set<number>([...HEADER_ONLY_KINDS, ReflectionKind.TypeAlias]);

const keyword = (text: string): TypePart => ({ kind: 'keyword', text });
const name = (text: string): TypePart => ({ kind: 'name', text });
const punctuation = (text: string): TypePart => ({ kind: 'punctuation', text });

/**
 * @description Lists the call signatures a page documents: a function's own, or those of the function a variable holds.
 * @param reflection The page's reflection.
 * @returns The signatures, empty for anything not callable.
 */
export function getCallSignatures(reflection: DocsReflection): DocsReflection[] {
	if (reflection.signatures?.length) {
		return reflection.signatures;
	}

	const type = reflection.type;

	return isCallableVariable(reflection) && type?.type === 'reflection'
		? (type.declaration.signatures ?? [])
		: [];
}

/**
 * @description Lists the members a page shows below its header: an interface's, class's or object type alias's own
 * (TypeDoc gives `type X = { … }` children, not a type), or those of the object type a variable names.
 * @param reflection The page's reflection.
 * @returns The members, empty when it has none.
 */
export function getObjectMembers(reflection: DocsReflection): DocsReflection[] {
	if (OBJECT_KINDS.has(reflection.kind) && reflection.children?.length) {
		return reflection.children;
	}

	const type = reflection.type;

	return type?.type === 'reflection' ? (type.declaration.children ?? []) : [];
}

function extendsParts(types: DocsType[] | undefined, ctx: TypeContext): TypePart[] {
	if (!types?.length) {
		return [];
	}

	return [
		keyword(' extends '),
		...types.flatMap((type, index) => [
			...(index ? [punctuation(', ')] : []),
			...typeToParts(type, ctx),
		]),
	];
}

/**
 * @description Renders where an inherited member comes from: `Parent.member`, linked to it.
 * @param member An interface's or class's member.
 * @param ctx Resolves references to their pages.
 * @returns The parts, empty for a member the type declares itself.
 */
export function getInheritedFrom(member: DocsReflection, ctx: TypeContext): TypePart[] {
	return member.inheritedFrom ? typeToParts(member.inheritedFrom, ctx) : [];
}

/**
 * @description Renders one call signature's declaration: `function name<T>(a: A): R`.
 * @param reflection The page's reflection.
 * @param signature One of its call signatures.
 * @param ctx Resolves references to their pages.
 * @returns The parts.
 */
export function getSignatureHeader(
	reflection: DocsReflection,
	signature: DocsReflection,
	ctx: TypeContext,
): TypePart[] {
	return [keyword('function '), name(reflection.name), ...signatureParts(signature, ctx, false)];
}

/**
 * @description Renders a non-callable declaration's header: `type Name<T> = …`, `const name: T`, `interface Name<T> extends Base`.
 * An object type whose members are listed below collapses to `{ … }`.
 * @param reflection The page's reflection.
 * @param ctx Resolves references to their pages.
 * @returns The parts.
 */
export function getDeclarationHeader(reflection: DocsReflection, ctx: TypeContext): TypePart[] {
	const word = DECLARATION_KEYWORDS[reflection.kind];
	const head = [
		...(word ? [keyword(`${word} `)] : []),
		name(reflection.name),
		...typeParameterParts(reflection.typeParameters, ctx),
	];
	const type = reflection.type;
	const listed = getObjectMembers(reflection).length > 0;

	if (HEADER_ONLY_KINDS.has(reflection.kind)) {
		return [...head, ...extendsParts(reflection.extendedTypes, ctx)];
	}

	if (!type && !listed) {
		return head;
	}

	const body = listed || !type ? [punctuation('{ … }')] : typeToParts(type, ctx);

	return [
		...head,
		punctuation(reflection.kind === ReflectionKind.TypeAlias ? ' = ' : ': '),
		...body,
	];
}

export default {
	getCallSignatures,
	getObjectMembers,
	getInheritedFrom,
	getSignatureHeader,
	getDeclarationHeader,
};
