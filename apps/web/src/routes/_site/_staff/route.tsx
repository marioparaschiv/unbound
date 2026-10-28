import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { IconFileCheck, IconPackage, IconUsers } from '@tabler/icons-react';
import type { ComponentType } from 'react';

import type { StaffSectionId } from '~/lib/auth/staff-areas';
import { getStaffSections } from '~/lib/auth/staff-areas';
import Text from '~/components/ui/text';

type IconProps = {
	size?: number;
};

const SECTION_ICONS: Record<StaffSectionId, ComponentType<IconProps>> = {
	review: IconFileCheck,
	users: IconUsers,
	addons: IconPackage,
};

function StaffLayout() {
	const { sections } = Route.useRouteContext();

	return (
		<div className='flex md:flex-row flex-col flex-1 gap-6 mb-12 page-frame'>
			<aside className='md:w-64 shrink-0'>
				<div className='top-6 sticky bg-linear-to-b from-transparent to-accent/50 shadow-lg backdrop-blur-md p-5 border rounded-3xl text-foreground'>
					<Text variant='heading-sm' className='mb-4 px-2'>
						Staff
					</Text>
					<nav className='flex flex-col gap-1'>
						{sections.map((section) => {
							const Icon = SECTION_ICONS[section.id];

							return (
								<Link
									key={section.id}
									to={section.to}
									className='flex items-center gap-3 data-[status=active]:bg-accent hover:bg-accent/50 px-3 py-2 rounded-xl text-muted-foreground data-[status=active]:text-foreground hover:text-foreground text-sm transition-colors'
								>
									<Icon size={18} />
									{section.label}
								</Link>
							);
						})}
					</nav>
				</div>
			</aside>
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
