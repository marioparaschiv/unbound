import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import KindBadge from '~/components/docs/kind-badge';
import type { DocsNav } from '~/lib/docs/docs-page';
import { DOCS_GROUPS } from '~/lib/docs/kinds';
import cn from '~/lib/cn';

type DocsSidebarProps = {
	nav: DocsNav;
	/** The open symbol page, or `undefined` on the overview. */
	symbol: string | undefined;
};

const GROUP_LABELS = new Map(DOCS_GROUPS.map((group) => [group.key, group.label]));

// Scrolls only the sidebar, never the window; `scrollIntoView` would scroll both.
// A group still expanding is too short to scroll to, so this waits for the sidebar's animations to end.
async function revealActiveItem(nav: HTMLElement | null) {
	const container = nav?.parentElement;

	if (!container) return;

	await Promise.allSettled(
		container.getAnimations({ subtree: true }).map((animation) => animation.finished),
	);

	const item = nav?.querySelector<HTMLElement>('[data-active="true"]');

	if (!item || container.scrollHeight <= container.clientHeight) return;

	const offset = item.getBoundingClientRect().top - container.getBoundingClientRect().top;

	if (offset < 0 || offset > container.clientHeight - item.offsetHeight) {
		container.scrollTop += offset - container.clientHeight / 2;
	}
}

/**
 * @description The SDK reference sidebar: every symbol in collapsible kind groups.
 * @param props The version's navigation and the open symbol.
 * @returns The sidebar.
 */
function DocsSidebar({ nav, symbol }: DocsSidebarProps) {
	const router = useRouter();
	const navRef = useRef<HTMLElement>(null);
	const route = { package: nav.package, version: nav.version };
	const activeGroup = nav.groups.find((group) =>
		group.symbols.some((entry) => entry.qualifiedName === symbol),
	)?.key;
	const [openGroups, setOpenGroups] = useState<string[]>(() => [
		'namespaces',
		...(activeGroup ? [activeGroup] : []),
	]);
	const [shownSymbol, setShownSymbol] = useState(symbol);

	// Every navigation reopens the open symbol's group, even one the reader collapsed; other groups keep their state.
	if (symbol !== shownSymbol) {
		setShownSymbol(symbol);

		if (activeGroup && !openGroups.includes(activeGroup)) {
			setOpenGroups([...openGroups, activeGroup]);
		}
	}

	// After a navigation renders, the router puts every scrolled element back where it was, so the
	// sidebar reveals its active entry only once the router has.
	useEffect(() => {
		void revealActiveItem(navRef.current);

		return router.subscribe('onRendered', () => void revealActiveItem(navRef.current));
	}, [router]);

	return (
		<nav ref={navRef} aria-label='SDK reference'>
			<Accordion type='multiple' value={openGroups} onValueChange={setOpenGroups}>
				{nav.groups.map((group) => (
					<AccordionItem key={group.key} value={group.key} className='border-b-0'>
						<AccordionTrigger className='py-2 font-semibold text-muted-foreground hover:text-foreground text-xs uppercase tracking-wide hover:no-underline hover:[&>svg]:text-foreground transition-colors press-flat [--press-depth:0.5]'>
							<span className='flex items-center gap-2'>
								{GROUP_LABELS.get(group.key)}
								<span className='font-normal normal-case tabular-nums'>
									{group.symbols.length}
								</span>
							</span>
						</AccordionTrigger>
						<AccordionContent className='flex flex-col pb-2'>
							{group.symbols.map((entry) => (
								<Link
									key={entry.qualifiedName}
									to='/docs/sdk/$version/$symbol'
									params={{ version: route.version, symbol: entry.qualifiedName }}
									title={entry.qualifiedName}
									// Loads each page the sidebar shows, so a click or tap renders without waiting on the server.
									preload='viewport'
									data-active={entry.qualifiedName === symbol}
									className={cn(
										'flex items-center gap-2 px-2 rounded-item h-8 font-mono text-[0.8125rem] press-flat outline-none focus-visible:ring-[3px] focus-visible:ring-halo',
										entry.qualifiedName === symbol
											? 'bg-accent text-foreground'
											: 'text-muted-foreground hover:bg-accent/50',
									)}
								>
									<KindBadge group={group.key} />
									<span className='single-line'>{entry.qualifiedName}</span>
								</Link>
							))}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</nav>
	);
}

export default DocsSidebar;
