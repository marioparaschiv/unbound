import { getRouteApi, Link, useRouteContext, useRouterState } from '@tanstack/react-router';
import { IconBox, IconFileCheck, IconUsers } from 'nucleo-micro-bold';
import type { ComponentType } from 'react';

import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import type { LabLayoutProps } from '~/components/lab/lab-variant';
import type { StaffSectionId } from '~/lib/auth/staff-areas';

type IconProps = {
	size?: number;
};

type SectionPath = '/lab/$variant/review' | '/lab/$variant/addons' | '/lab/$variant/users';

const SECTION_ICONS: Record<StaffSectionId, ComponentType<IconProps>> = {
	review: IconFileCheck,
	users: IconUsers,
	addons: IconBox,
};

const SECTION_PATHS: Record<StaffSectionId, SectionPath> = {
	review: '/lab/$variant/review',
	users: '/lab/$variant/users',
	addons: '/lab/$variant/addons',
};

const variantRoute = getRouteApi('/_site/_staff/lab/$variant');

/** The staff area as one more page of the site: a small Staff label and the sections as a segmented control. */
function Layout({ children }: LabLayoutProps) {
	const { sections } = useRouteContext({ from: '/_site/_staff' });
	const { variant } = variantRoute.useParams();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const active = sections.find((section) => pathname.startsWith(`/lab/${variant}/${section.id}`));

	return (
		<div className='flex flex-col flex-1 gap-8 page-frame'>
			<div className='flex flex-wrap items-center gap-4'>
				<Segmented
					value={active?.id ?? null}
					className='max-w-full overflow-x-auto hide-scrollbar'
				>
					{sections.map((section) => {
						const Icon = SECTION_ICONS[section.id];

						return (
							<SegmentedItem
								key={section.id}
								value={section.id}
								asChild
								className='gap-2 text-sm'
							>
								<Link to={SECTION_PATHS[section.id]} params={{ variant }}>
									<Icon size={16} />
									<span>{section.label}</span>
								</Link>
							</SegmentedItem>
						);
					})}
				</Segmented>
			</div>
			<main className='flex-1 min-w-0'>{children}</main>
		</div>
	);
}

export default Layout;
