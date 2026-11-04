import { IconDownload } from 'nucleo-micro-bold';
import { useMemo } from 'react';

import type { OpenApiDocument } from '~/lib/api/openapi/openapi-document';
import HttpOperation from '~/components/http/http-operation';
import { groupOperations } from '~/lib/docs/http-reference';
import useActiveHeading from '~/hooks/use-active-heading';
import HttpSidebar from '~/components/http/http-sidebar';
import HttpSearch from '~/components/http/http-search';
import DocsShell from '~/components/docs/docs-shell';
import Heading from '~/components/guides/heading';
import PageHeader from '~/components/page-header';
import { Button } from '~/components/ui/button';
import Prose from '~/components/http/prose';
import Text from '~/components/ui/text';

type HttpReferenceProps = {
	document: OpenApiDocument;
};

/** Where the document this page renders is downloaded from. */
export const OPENAPI_PATH = '/api/v1/openapi.json';

/**
 * @description The HTTP reference in the docs shell: every public operation on one page, grouped by
 * tag, with a sidebar of anchors and a link to the OpenAPI document it renders.
 * @param props The OpenAPI document.
 * @returns The page.
 */
function HttpReference({ document }: HttpReferenceProps) {
	const groups = useMemo(() => groupOperations(document), [document]);
	const operations = useMemo(() => groups.flatMap((group) => group.operations), [groups]);
	const anchors = useMemo(() => operations.map((entry) => entry.anchor), [operations]);
	const active = useActiveHeading(anchors);
	const serverUrl = document.servers[0]?.url ?? '';

	return (
		<DocsShell
			label='HTTP reference'
			title={
				operations.find((entry) => entry.anchor === active)?.operation.summary ?? 'HTTP API'
			}
			sidebar={<HttpSidebar groups={groups} active={active} />}
			renderSearch={(state) => <HttpSearch operations={operations} {...state} />}
		>
			<article className='flex flex-col gap-6 min-w-0'>
				<PageHeader
					title='HTTP API'
					description='Public endpoints you can call without signing in. Each one returns JSON.'
				>
					<Button variant='outline' asChild>
						<a href={OPENAPI_PATH} download='unbound-openapi.json'>
							<IconDownload />
							OpenAPI document
						</a>
					</Button>
				</PageHeader>
				<Prose text='A failure returns a non-2xx status with `{ error: { code, message } }`.' />
				{/* The page header's 32px already opens the page, so the first group's h2 drops its top margin. */}
				{groups.map((group) => (
					<section key={group.name} className='flex flex-col gap-6'>
						<div className='flex flex-col gap-2'>
							<Heading level='h2' id={group.name.toLowerCase()}>
								{group.name}
							</Heading>
							<Text variant='text-md' color='muted'>
								{group.description}
							</Text>
						</div>
						{group.operations.map((entry) => (
							<HttpOperation key={entry.anchor} entry={entry} serverUrl={serverUrl} />
						))}
					</section>
				))}
			</article>
		</DocsShell>
	);
}

export default HttpReference;
