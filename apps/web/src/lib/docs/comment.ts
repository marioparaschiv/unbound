import type {
	DocsComment,
	DocsCommentPart,
	DocsInlineTag,
	DocsReflection,
} from '~/lib/docs/typedoc';
import type { DocsLocation } from '~/lib/docs/docs-index';

export type CommentContext = {
	resolve: (id: number) => DocsLocation | undefined;
	/** The URL of a location in the version being read. */
	href: (location: DocsLocation) => string;
};

const LINK_TAGS = new Set(['@link', '@linkcode', '@linkplain']);

function inlineTagMarkdown(part: DocsInlineTag, ctx: CommentContext): string {
	const label = part.tag === '@linkcode' ? `\`${part.text}\`` : part.text;

	if (!LINK_TAGS.has(part.tag)) {
		return part.text;
	}

	if (typeof part.target === 'string') {
		return `[${label}](${part.target})`;
	}

	const location = typeof part.target === 'number' ? ctx.resolve(part.target) : undefined;

	return location ? `[${label}](${ctx.href(location)})` : `\`${part.text}\``;
}

/**
 * @description Turns comment parts into markdown for the markdown component, with `{@link}` tags as links
 * to their pages and unresolved ones as code.
 * @param parts The comment parts.
 * @param ctx Resolves link targets.
 * @returns The markdown.
 */
export function commentToMarkdown(parts: DocsCommentPart[], ctx: CommentContext): string {
	return parts
		.map((part) => (part.kind === 'inline-tag' ? inlineTagMarkdown(part, ctx) : part.text))
		.join('');
}

/**
 * @description Picks the comment documenting a reflection: its own, else its first call signature's.
 * @param reflection A declaration, or a variable holding a function.
 * @returns The comment, or `undefined` when it has none.
 */
export function getDocComment(reflection: DocsReflection): DocsComment | undefined {
	const type = reflection.type;
	const typeSignature =
		type?.type === 'reflection' ? type.declaration.signatures?.[0] : undefined;

	return reflection.comment ?? reflection.signatures?.[0]?.comment ?? typeSignature?.comment;
}

/**
 * @description Reads a comment's prose: the summary, then the `@description` block tag the SDK writes.
 * @param comment The comment.
 * @returns The parts, empty when it has neither.
 */
export function getDescription(comment: DocsComment | undefined): DocsCommentPart[] {
	const description = comment?.blockTags?.find((tag) => tag.tag === '@description');
	const summary = comment?.summary ?? [];

	if (!description) {
		return summary;
	}

	return summary.length
		? [...summary, { kind: 'text', text: '\n\n' }, ...description.content]
		: description.content;
}

/**
 * @description Reports whether a comment marks its reflection deprecated.
 * @param comment The comment.
 * @returns Whether it holds a `@deprecated` tag.
 */
export function isDeprecated(comment: DocsComment | undefined): boolean {
	return Boolean(comment?.blockTags?.some((tag) => tag.tag === '@deprecated'));
}

export default { commentToMarkdown, getDocComment, getDescription, isDeprecated };
