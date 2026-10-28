import {
	IconBookmark,
	IconHome,
	IconMenu2,
	IconPalette,
	IconPlug,
	IconUsers,
} from '@tabler/icons-react';
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
	{ path: '/', title: 'Home', icon: IconHome },
	{ path: '/plugins', title: 'Plugins', icon: IconPlug },
	{ path: '/themes', title: 'Themes', icon: IconPalette },
	{ path: '/developers', title: 'Team', icon: IconUsers },
	{ path: '/faq', title: 'FAQ', icon: IconBookmark },
];

const INDICATOR_TRANSITION = { duration: 0.3, ease: 'easeInOut' } as const;

function Header() {
	const pathname = useLocation({ select: (location) => location.pathname });
	const [hovered, setHovered] = useState<string | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	// The highlight follows the hovered link and rests on the current page's link otherwise.
	const highlighted = hovered ?? pathname;

	return (
		<header className='flex flex-col items-center'>
			<div
				id='header'
				className='z-20 sticky flex justify-center items-center mx-auto my-6 px-2 md:px-0 h-18 pointer-events-none container'
			>
				<div className='flex flex-col bg-background bg-linear-to-b to-accent/40 shadow-lg backdrop-blur-md px-5 border rounded-3xl w-full text-foreground pointer-events-auto'>
					<div className='flex flex-1 items-center gap-4'>
						<Link to='/'>
							<Logo className='size-16 text-foreground hover:scale-110 transition-all duration-300 cursor-pointer' />
						</Link>

						<Separator orientation='vertical' className='hidden sm:flex h-5!' />

						<div className='relative flex-1'>
							<nav
								className='hidden md:flex gap-2'
								onMouseLeave={() => setHovered(null)}
							>
								{ROUTES.map((route) => (
									<Link
										key={route.path}
										className={cn(
											'relative px-4 py-2 rounded-lg font-semibold text-muted-foreground hover:text-foreground text-base tracking-tight transition-colors duration-150 cursor-pointer',
											route.path === pathname && 'text-foreground bg-accent',
										)}
										onMouseEnter={() => setHovered(route.path)}
										to={route.path}
									>
										{route.path === highlighted ? (
											<motion.span
												layoutId='header-highlight'
												transition={INDICATOR_TRANSITION}
												className='absolute inset-0 bg-accent/50 rounded-lg pointer-events-none'
											/>
										) : null}
										{/* The highlight lives in whichever link is hovered, which can come later in the DOM than this label while it slides past, so the label sits above every highlight. */}
										<span className='z-10 relative'>{route.title}</span>
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
										<IconMenu2 size={16} />
									</Button>
								</DrawerTrigger>
								<DrawerContent>
									<nav className='flex flex-col gap-1 p-4'>
										{ROUTES.map((route) => (
											<DrawerClose key={route.path} asChild>
												<Link
													className={cn(
														'flex items-center gap-4 px-4 py-3 rounded-xl text-muted-foreground text-base transition-colors',
														pathname === route.path &&
															'bg-accent text-foreground font-semibold',
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
