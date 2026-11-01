import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';

import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { ADDON_TABS, getAddonTab } from '~/lib/addon-tabs';

function AddonsLayout() {
	const tab = useLocation({ select: (location) => getAddonTab(location.pathname)?.type ?? null });

	return (
		<div className='flex flex-col flex-1 gap-6 page-frame'>
			{/* The site nav's own control, so the addon tabs read as one more level of it. */}
			<div className='-m-1 p-1 overflow-x-auto hide-scrollbar'>
				<Segmented value={tab} tone='header' aria-label='Addons'>
					{ADDON_TABS.map((entry) => (
						<SegmentedItem
							key={entry.type}
							value={entry.type}
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

export const Route = createFileRoute('/_site/addons/_listing')({
	component: AddonsLayout,
});
