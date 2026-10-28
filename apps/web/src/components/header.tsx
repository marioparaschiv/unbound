import {
	IconBookmark,
	IconHouse,
	IconMenu2,
	IconPalette,
	IconPlug,
	IconUsers,
} from 'nucleo-micro-bold';
import { Link, useLocation } from '@tanstack/react-router';
import type { ComponentType } from 'react';
import { useState } from 'react';

import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '~/components/ui/drawer';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import AccountMenu from '~/components/account-menu';
import { Button } from '~/components/ui/button';
import Logo from '~/components/icons/logo';
import cn from '~/lib/cn';

type IconProps = {
	size?: number;
};

type NavRoute = {
	path: string;
	title: string;
	icon: ComponentType<IconProps>;
};

const ROUTES: NavRoute[] = [
	{ path: '/', title: 'Home', icon: IconHouse },
	{ path: '/plugins', title: 'Plugins', icon: IconPlug },
	{ path: '/themes', title: 'Themes', icon: IconPalette },
	{ path: '/developers', title: 'Developers', icon: IconUsers },
	{ path: '/faq', title: 'FAQ', icon: IconBookmark },
];

function Header() {
	const pathname = useLocation({ select: (location) => location.pathname });
	const [drawerOpen, setDrawerOpen] = useState(false);

	return (
		<header className='flex flex-col items-center'>
			{/* No bar around the row: the nav capsule is the only container, centred by the grid. */}
			<div id='header' className='z-20 sticky my-6 page-frame'>
				<div className='items-center grid grid-cols-[1fr_auto_1fr] h-11'>
					<Link
						to='/'
						className='flex items-center justify-self-start pr-2.5 pl-0 rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo h-11 press-flat'
					>
						<Logo className='w-13 h-auto aspect-[474/202] text-foreground' />
					</Link>

					<Segmented
						value={pathname}
						layoutId='header-highlight'
						tone='header'
						className='hidden md:flex'
					>
						{ROUTES.map((route) => (
							<SegmentedItem
								key={route.path}
								value={route.path}
								className='text-base tracking-tight'
								asChild
							>
								<Link to={route.path}>
									<span className='relative'>{route.title}</span>
								</Link>
							</SegmentedItem>
						))}
					</Segmented>

					<div className='flex items-center justify-self-end gap-2 col-start-3'>
						<AccountMenu />
						<Drawer direction='top' open={drawerOpen} onOpenChange={setDrawerOpen}>
							<DrawerTrigger asChild>
								<Button
									variant='outline'
									size='icon'
									className='md:hidden flex'
									aria-label='Open menu'
								>
									<IconMenu2 size={24} />
								</Button>
							</DrawerTrigger>
							<DrawerContent>
								<nav className='flex flex-col gap-1 p-4'>
									{ROUTES.map((route) => (
										<DrawerClose key={route.path} asChild>
											<Link
												className={cn(
													'flex items-center gap-4 px-4 rounded-inner outline-none focus-visible:ring-[3px] focus-visible:ring-halo h-12 text-muted-foreground text-base',
													pathname === route.path
														? 'bg-accent shadow-key text-foreground font-semibold'
														: 'press-flat',
												)}
												to={route.path}
											>
												<route.icon size={20} />
												{route.title}
											</Link>
										</DrawerClose>
									))}
								</nav>
							</DrawerContent>
						</Drawer>
					</div>
				</div>
			</div>
		</header>
	);
}

export default Header;
