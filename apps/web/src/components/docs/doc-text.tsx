import type { DocsRenderContext } from '~/lib/docs/docs-links';
import type { DocsCommentPart } from '~/lib/docs/typedoc';
import { commentToMarkdown } from '~/lib/docs/comment';
import { resolveDocsUrl } from '~/lib/docs/docs-links';
import Markdown from '~/components/markdown';

type DocTextProps = {
	parts: DocsCommentPart[];
	ctx: DocsRenderContext;
};

/**
 * @description Renders comment prose through the markdown component, `{@link}` tags as links between symbols.
 * @param props The comment parts and the page's render context.
 * @returns The prose, or nothing for an empty comment.
 */
function DocText({ parts, ctx }: DocTextProps) {
	const source = commentToMarkdown(parts, ctx).trim();

	return source ? <Markdown source={source} resolveUrl={resolveDocsUrl} /> : null;
}

export default DocText;
