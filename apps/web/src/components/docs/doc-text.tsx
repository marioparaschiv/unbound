import type { MarkdownCodeRenderer } from '~/components/markdown';
import type { DocsRenderContext } from '~/lib/docs/docs-links';
import DocsCodeBlock from '~/components/docs/docs-code-block';
import type { DocsCommentPart } from '~/lib/docs/typedoc';
import { commentToMarkdown } from '~/lib/docs/comment';
import { resolveDocsUrl } from '~/lib/docs/docs-links';
import Markdown from '~/components/markdown';

type DocTextProps = {
	parts: DocsCommentPart[];
	ctx: DocsRenderContext;
};

const renderCode: MarkdownCodeRenderer = (code) => <DocsCodeBlock {...code} />;

/**
 * @description Renders comment prose through the markdown component, `{@link}` tags as links between symbols
 * and fenced code, such as an `@example`, as a highlighted code block.
 * @param props The comment parts and the page's render context.
 * @returns The prose, or nothing for an empty comment.
 */
function DocText({ parts, ctx }: DocTextProps) {
	const source = commentToMarkdown(parts, ctx).trim();

	return source ? (
		<Markdown source={source} resolveUrl={resolveDocsUrl} renderCode={renderCode} />
	) : null;
}

export default DocText;
