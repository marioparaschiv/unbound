import { IconMagnifier, IconSidebarLeft } from 'nucleo-micro-bold';
import { useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '~/components/ui/drawer';
import { Button } from '~/components/ui/button';
import Kbd from '~/components/ui/kbd';

// The search dialog's open and close animations. Their keyframes cannot reverse, so toggling mid-way snaps the opacity.
const TOGGLE_MS = 200;

export type DocsSearchState = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type DocsShellProps = {
	/** Names the sidebar's navigation, such as `User guide`. */
	label: string;
	/** The open page's title, shown in the phone bar that opens the sidebar. */
	title: string;
	sidebar: ReactNode;
	renderSearch: (state: DocsSearchState) => ReactNode;
	children: ReactNode;
};

/**
 * @description The layout every docs tab shares. From `lg` up, a sticky scrolling sidebar beside the page;
 * below it, a bar with the page's title that opens the sidebar in a drawer, which closes on navigation.
 * `⌘K` opens the tab's search either way, and closes it again; presses during the open or close animation are ignored.
 * @param props The sidebar, the search dialog, the open page's title and the page.
 * @returns The shell.
 */
function DocsShell({ label, title, sidebar, renderSearch, children }: DocsShellProps) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const toggledAt = useRef(0);
	const href = useLocation({ select: (location) => location.href });
	const [shownHref, setShownHref] = useState(href);

	if (href !== shownHref) {
		setShownHref(href);
		setMenuOpen(false);
	}

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (!((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
				return;
			}

			event.preventDefault();

			// A held key repeats, and a quick second press would interrupt the running animation.
			if (event.repeat || event.timeStamp - toggledAt.current < TOGGLE_MS) {
				return;
			}

			toggledAt.current = event.timeStamp;
			setSearchOpen((open) => !open);
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

	return (
		<div className='items-start gap-x-10 gap-y-6 grid lg:grid-cols-[16rem_minmax(0,1fr)]'>
			<div className='lg:hidden flex gap-2 min-w-0'>
				<Drawer open={menuOpen} onOpenChange={setMenuOpen}>
					<DrawerTrigger asChild>
						<Button variant='outline' className='flex-1 justify-start px-3 min-w-0'>
							<IconSidebarLeft />
							<span className='single-line'>{title}</span>
						</Button>
					</DrawerTrigger>
					<DrawerContent>
						<DrawerTitle className='sr-only'>{label}</DrawerTitle>
						<div className='p-4 overflow-y-auto'>{sidebar}</div>
					</DrawerContent>
				</Drawer>
				<Button
					variant='outline'
					size='icon'
					aria-label='Search'
					onClick={() => setSearchOpen(true)}
				>
					<IconMagnifier />
				</Button>
			</div>
			{/* The 4px of padding, taken back by the negative margin, keeps focus rings inside the scroll clip. */}
			<aside className='hidden top-5 sticky lg:flex flex-col gap-3 -m-1 p-1 pr-3 max-h-[calc(100dvh-2.5rem)] overflow-y-auto'>
				<button
					type='button'
					onClick={() => setSearchOpen(true)}
					// The key sits as far from the right edge as from the top and bottom, so its corners stay concentric with the field's.
					className='flex items-center gap-2 pr-[4.5px] pl-3 w-full h-9 text-muted-foreground text-sm shrink-0 field press-flat'
				>
					<IconMagnifier className='size-4' />
					Search
					<Kbd className='ml-auto'>⌘K</Kbd>
				</button>
				{sidebar}
			</aside>
			<main className='min-w-0'>{children}</main>
			{renderSearch({ open: searchOpen, onOpenChange: setSearchOpen })}
		</div>
	);
}

export default DocsShell;
