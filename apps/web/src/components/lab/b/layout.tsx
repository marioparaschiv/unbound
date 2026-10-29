import { getRouteApi, Link, useLocation, useRouteContext } from '@tanstack/react-router';
import { IconBox, IconFileCheck, IconUsers } from 'nucleo-micro-bold';
import type { ComponentType } from 'react';

import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import type { LabLayoutProps } from '~/components/lab/lab-variant';
import type { StaffSectionId } from '~/lib/auth/staff-areas';
import Text from '~/components/ui/text';

type IconProps = {
	size?: number;
};

type LabSection = {
	id: StaffSectionId;
	label: string;
	to: '/lab/$variant/review' | '/lab/$variant/addons' | '/lab/$variant/users';
};

const SECTION_ICONS: Record<StaffSectionId, ComponentType<IconProps>> = {
	review: IconFileCheck,
	users: IconUsers,
	addons: IconBox,
};

const SECTION_PATHS: Record<StaffSectionId, LabSection['to']> = {
	review: '/lab/$variant/review',
	users: '/lab/$variant/users',
	addons: '/lab/$variant/addons',
};

const variantRoute = getRouteApi('/_site/_staff/lab/$variant');

// Staff areas sit in a tab row on top, so the left column is free for each page's own section nav.
function Layout({ children }: LabLayoutProps) {
	const { sections } = useRouteContext({ from: '/_site/_staff' });
	const { variant } = variantRoute.useParams();
	const area = useLocation({ select: (location) => location.pathname.split('/')[3] ?? null });

	return (
		<div className='flex flex-col flex-1 gap-8 pb-24 page-frame'>
			<div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
				<Text as='span' variant='text-sm' color='muted' className='font-semibold'>
					Staff
				</Text>
				<Segmented value={area}>
					{sections.map((section) => {
						const Icon = SECTION_ICONS[section.id];

						return (
							<SegmentedItem
								key={section.id}
								value={section.id}
								className='text-sm'
								asChild
							>
								<Link to={SECTION_PATHS[section.id]} params={{ variant }}>
									<span className='relative flex items-center gap-2'>
										<Icon size={16} />
										{section.label}
									</span>
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
