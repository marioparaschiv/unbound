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
import { motion } from 'motion/react';
import { useState } from 'react';

import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '~/components/ui/drawer';
import AccountMenu from '~/components/account-menu';
import Separator from '~/components/ui/separator';
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

const INDICATOR_TRANSITION = { type: 'spring', stiffness: 500, damping: 38 } as const;

// One raised pill marks the hovered or current page, in the desktop bar and the mobile drawer.
const NAV_SURFACE = 'bg-accent [--ledge:var(--ledge-secondary)] press';
const NAV_PILL = cn('absolute inset-0 rounded-control pointer-events-none', NAV_SURFACE);

function Header() {
	const pathname = useLocation({ select: (location) => location.pathname });
	const [hovered, setHovered] = useState<string | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	// The highlight follows the hovered link and rests on the current page's link otherwise.
	const highlighted = hovered ?? pathname;

	return (
		<header className='flex flex-col items-center'>
			<div id='header' className='z-20 sticky mt-6 pointer-events-none page-frame'>
				<div className='bg-card/80 shadow-surface backdrop-blur-md pt-2.5 pr-2.5 pb-3.5 pl-3.5 border rounded-surface w-full text-foreground pointer-events-auto'>
					<div className='flex items-center gap-3 h-11'>
						<Link
							to='/'
							className='flex justify-center items-center rounded-control outline-none focus-visible:ring-4 focus-visible:ring-halo size-11 shrink-0 press-flat'
						>
							<Logo className='size-9 text-foreground' />
						</Link>

						<Separator orientation='vertical' className='hidden md:flex h-5!' />

						<div className='relative flex-1'>
							<nav
								className='hidden md:flex gap-1'
								onMouseLeave={() => setHovered(null)}
							>
								{ROUTES.map((route) => (
									<Link
										key={route.path}
										className={cn(
											'inline-flex relative items-center px-4 rounded-control outline-none focus-visible:ring-4 focus-visible:ring-halo h-11 font-semibold text-muted-foreground hover:text-foreground text-base tracking-tight transition-colors cursor-pointer press-flat',
											route.path === pathname && 'text-foreground',
										)}
										onMouseEnter={() => setHovered(route.path)}
										to={route.path}
									>
										{route.path === highlighted ? (
											<motion.span
												layoutId='header-highlight'
												transition={INDICATOR_TRANSITION}
												className={NAV_PILL}
											/>
										) : null}
										<span className='relative'>{route.title}</span>
									</Link>
								))}
							</nav>
						</div>

						<div className='flex justify-center items-center gap-2'>
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
														'flex items-center gap-4 px-4 rounded-control outline-none focus-visible:ring-4 focus-visible:ring-halo h-12 text-muted-foreground text-base',
														pathname === route.path
															? cn(
																	NAV_SURFACE,
																	'text-foreground font-semibold',
																)
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
			</div>
		</header>
	);
}

export default Header;
