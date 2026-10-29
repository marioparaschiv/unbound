import { getRouteApi, Link, useLocation, useRouteContext } from '@tanstack/react-router';
import { IconBox, IconFileCheck, IconUsers } from 'nucleo-micro-bold';
import type { ComponentType } from 'react';

import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import type { LabLayoutProps } from '~/components/lab/lab-variant';
import type { StaffSectionId } from '~/lib/auth/staff-areas';

type IconProps = {
	size?: number;
};

const SECTION_ICONS: Record<StaffSectionId, ComponentType<IconProps>> = {
	review: IconFileCheck,
	users: IconUsers,
	addons: IconBox,
};

const SECTION_PATHS = {
	review: '/lab/$variant/review',
	users: '/lab/$variant/users',
	addons: '/lab/$variant/addons',
} as const satisfies Record<StaffSectionId, string>;

const variantRoute = getRouteApi('/_site/_staff/lab/$variant');

// A section strip over the page instead of a second sidebar, so the panes get the full width.
function Layout({ children }: LabLayoutProps) {
	const { sections } = useRouteContext({ from: '/_site/_staff' });
	const { variant } = variantRoute.useParams();
	const { pathname } = useLocation();
	const active = sections.find((section) => pathname.includes(`/${section.id}`))?.id ?? null;

	return (
		<div className='flex flex-col flex-1 gap-6 page-frame'>
			<Segmented value={active}>
				{sections.map((section) => {
					const Icon = SECTION_ICONS[section.id];

					return (
						<SegmentedItem
							key={section.id}
							value={section.id}
							asChild
							className='text-sm'
						>
							<Link to={SECTION_PATHS[section.id]} params={{ variant }}>
								<span className='inline-flex items-center gap-2'>
									<Icon size={16} />
									{section.label}
								</span>
							</Link>
						</SegmentedItem>
					);
				})}
			</Segmented>
			{children}
		</div>
	);
}

export default Layout;
