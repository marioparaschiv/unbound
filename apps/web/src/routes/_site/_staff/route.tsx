import { Link, Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router';
import { IconBox, IconFileCheck, IconUsers } from 'nucleo-micro-bold';
import type { ComponentType } from 'react';

import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import type { StaffSectionId } from '~/lib/auth/staff-areas';
import { getStaffSections } from '~/lib/auth/staff-areas';

type IconProps = {
	size?: number;
};

const SECTION_ICONS: Record<StaffSectionId, ComponentType<IconProps>> = {
	review: IconFileCheck,
	users: IconUsers,
	addons: IconBox,
};

/** The staff area as one more page of the site: its sections as a segmented control over the page. */
function StaffLayout() {
	const { sections } = Route.useRouteContext();
	const pathname = useLocation({ select: (location) => location.pathname });
	const active = sections.find((section) => pathname.startsWith(section.to));

	return (
		<div className='flex flex-col flex-1 gap-8 page-frame'>
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
							<Link to={section.to}>
								<Icon size={16} />
								<span>{section.label}</span>
							</Link>
						</SegmentedItem>
					);
				})}
			</Segmented>
			<main className='flex-1 min-w-0'>
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff')({
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}

		const { user } = context.session;
		const sections = getStaffSections(user.role);

		if (sections.length === 0) {
			throw redirect({ to: '/' });
		}

		return { user, sections };
	},
	component: StaffLayout,
});
