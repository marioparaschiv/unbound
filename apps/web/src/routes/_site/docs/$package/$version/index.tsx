import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';

import { DOCS_GROUPS, type DocsGroupKey } from '~/lib/docs/kinds';
import KindBadge from '~/components/docs/kind-badge';
import type { DocsNav } from '~/lib/docs/docs-page';
import { docsNavQuery } from '~/queries/docs/docs';
import PageHeader from '~/components/page-header';
import Text from '~/components/ui/text';

type NamespaceSummary = {
	name: string;
	counts: { group: DocsGroupKey; count: number }[];
};

const layout = getRouteApi('/_site/docs/$package/$version');

/** Counts each namespace's direct members per kind, from the sidebar's flat symbol list. */
function summarizeNamespaces(nav: DocsNav): NamespaceSummary[] {
	const namespaces = nav.groups.find((group) => group.key === 'namespaces')?.symbols ?? [];
	const counts = new Map(
		namespaces.map((entry) => [entry.qualifiedName, new Map<DocsGroupKey, number>()]),
	);

	for (const group of nav.groups) {
		for (const entry of group.symbols) {
			const owner = entry.qualifiedName.slice(0, entry.qualifiedName.lastIndexOf('.'));
			const kinds = counts.get(owner);

			kinds?.set(group.key, (kinds.get(group.key) ?? 0) + 1);
		}
	}

	return namespaces.map((entry) => ({
		name: entry.qualifiedName,
		counts: DOCS_GROUPS.flatMap(({ key }) => {
			const count = counts.get(entry.qualifiedName)?.get(key);

			return count ? [{ group: key, count }] : [];
		}),
	}));
}

function DocsOverview() {
	const route = layout.useLoaderData();
	const { data: nav } = useSuspenseQuery(docsNavQuery(route.package, route.version));
	const namespaces = nav ? summarizeNamespaces(nav) : [];

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title={`@unbound-app/${route.package}`}
				description={`The plugin SDK reference, ${route.version === 'main' ? 'built from main' : `as released in ${route.version}`}. Every namespace is available on the unbound global and as its own import.`}
			/>
			<pre className='bg-muted/60 px-4 py-3 border rounded-control overflow-x-auto font-mono text-sm'>
				<code>
					<span className='text-primary'>import</span> {'{ plugins }'}{' '}
					<span className='text-primary'>from</span>{' '}
					<span className='text-amber-700 dark:text-amber-400'>
						'@unbound-app/{route.package}'
					</span>
					;
				</code>
			</pre>
			<div className='gap-3 grid sm:grid-cols-2 xl:grid-cols-3'>
				{namespaces.map((namespace) => (
					<Link
						key={namespace.name}
						to='/docs/$package/$version/$symbol'
						params={{ ...route, symbol: namespace.name }}
						className='flex flex-col gap-3 bg-card p-4 border rounded-surface shadow-surface hover:border-primary/40 transition-colors press-flat'
					>
						<div className='flex items-center gap-2'>
							<KindBadge group='namespaces' />
							<Text as='span' variant='text-md' className='font-mono font-semibold'>
								{namespace.name}
							</Text>
						</div>
						<div className='flex flex-wrap gap-3'>
							{namespace.counts.map(({ group, count }) => (
								<span
									key={group}
									className='flex items-center gap-1.5 text-muted-foreground text-xs'
								>
									<KindBadge group={group} className='size-4 text-[9px]' />
									{count}
								</span>
							))}
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}

export const Route = createFileRoute('/_site/docs/$package/$version/')({
	head: ({ params }) => ({ meta: [{ title: `Unbound | API reference · ${params.version}` }] }),
	component: DocsOverview,
});
