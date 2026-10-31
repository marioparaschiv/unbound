import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';

import { getCallSignatures, getDeclarationHeader, getObjectMembers } from '~/lib/docs/declaration';
import { getDescription, getDocComment, isDeprecated } from '~/lib/docs/comment';
import { NamespaceMembers, ObjectMembers } from '~/components/docs/member-list';
import { createDocsRenderContext, type DocsRoute } from '~/lib/docs/docs-links';
import SignatureBlock, { CodeBlock } from '~/components/docs/signature-block';
import BlockTags, { DeprecatedNote } from '~/components/docs/block-tags';
import type { DocsPageData } from '~/lib/docs/docs-page';
import KindBadge from '~/components/docs/kind-badge';
import DocText from '~/components/docs/doc-text';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type SymbolPageProps = {
	page: DocsPageData;
	route: DocsRoute;
	/** Every page of the version, so breadcrumb segments link only where a page exists. */
	pages: Set<string>;
};

type BreadcrumbsProps = {
	qualifiedName: string;
	route: DocsRoute;
	pages: Set<string>;
};

function Breadcrumbs({ qualifiedName, route, pages }: BreadcrumbsProps) {
	const segments = qualifiedName.split('.');

	return (
		<div className='flex flex-wrap items-center gap-1 font-mono text-muted-foreground text-sm'>
			<Link
				to='/docs/$package/$version'
				params={route}
				className='hover:text-foreground underline-offset-4 hover:underline'
			>
				@unbound-app/{route.package}
			</Link>
			{segments.slice(0, -1).map((segment, index) => {
				const symbol = segments.slice(0, index + 1).join('.');

				return (
					<Fragment key={symbol}>
						<span aria-hidden>/</span>
						{pages.has(symbol) ? (
							<Link
								to='/docs/$package/$version/$symbol'
								params={{ ...route, symbol }}
								className='hover:text-foreground underline-offset-4 hover:underline'
							>
								{segment}
							</Link>
						) : (
							<span>{segment}</span>
						)}
					</Fragment>
				);
			})}
		</div>
	);
}

/**
 * @description One symbol's reference page: its declaration or signatures, prose, parameters, return
 * value, block tags, and its members.
 * @param props The page data, its version, and the version's pages.
 * @returns The page body.
 */
function SymbolPage({ page, route, pages }: SymbolPageProps) {
	const { reflection, symbol } = page;
	const ctx = createDocsRenderContext(route, page.links);
	const comment = getDocComment(reflection);
	const signatures = getCallSignatures(reflection);
	const members = getObjectMembers(reflection);

	return (
		<article className='flex flex-col gap-8 min-w-0'>
			<header className='flex flex-col gap-3'>
				<Breadcrumbs qualifiedName={symbol.qualifiedName} route={route} pages={pages} />
				<div className='flex flex-wrap items-center gap-3'>
					<KindBadge group={symbol.group} className='size-7 text-sm' />
					<Text as='h1' variant='heading-lg' className='font-mono break-all'>
						{reflection.name}
					</Text>
					{isDeprecated(comment) ? <Tag variant='warning'>Deprecated</Tag> : null}
				</div>
			</header>

			<DeprecatedNote comment={comment} ctx={ctx} />

			<DocText parts={getDescription(comment)} ctx={ctx} />

			{signatures.length ? (
				<div className='flex flex-col gap-8'>
					{signatures.map((signature) => (
						<SignatureBlock
							key={signature.id}
							reflection={reflection}
							signature={signature}
							ctx={ctx}
						/>
					))}
				</div>
			) : (
				<CodeBlock parts={getDeclarationHeader(reflection, ctx)} ctx={ctx} />
			)}

			<BlockTags comment={comment} ctx={ctx} />

			{members.length ? <ObjectMembers members={members} ctx={ctx} /> : null}

			{page.members.length ? <NamespaceMembers members={page.members} ctx={ctx} /> : null}
		</article>
	);
}

export default SymbolPage;
