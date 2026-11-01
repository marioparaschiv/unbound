import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';

import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { DOCS_TABS, getDocsTab } from '~/lib/docs/docs-tabs';

function DocsAreaLayout() {
	const tab = useLocation({ select: (location) => getDocsTab(location.pathname)?.key ?? null });

	return (
		<div className='flex flex-col gap-6 page-frame'>
			{/* The site nav's own control, so the docs tabs read as one more level of it. */}
			<div className='-m-1 p-1 overflow-x-auto hide-scrollbar'>
				<Segmented value={tab} tone='header' aria-label='Docs'>
					{DOCS_TABS.map((entry) => (
						<SegmentedItem
							key={entry.key}
							value={entry.key}
							className='text-base tracking-tight whitespace-nowrap'
							asChild
						>
							<Link to={entry.path}>
								<span className='relative'>{entry.label}</span>
							</Link>
						</SegmentedItem>
					))}
				</Segmented>
			</div>
			<Outlet />
		</div>
	);
}

export const Route = createFileRoute('/_site/docs')({
	component: DocsAreaLayout,
});
