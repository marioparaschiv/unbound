import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import { GUIDE_NAV, type GuideFolder, type GuideTab } from '~/lib/guides/guide-nav';
import { GUIDE_ICONS } from '~/components/guides/guide-icons';
import { getGuide, getGuidePath } from '~/lib/guides/guides';
import cn from '~/lib/cn';

type GuideSidebarProps = {
	tab: GuideTab;
	/** The open page. */
	slug: string;
};

type GuideSidebarLinkProps = GuideSidebarProps & {
	entry: string;
};

const ROW_CLASS =
	'flex items-center gap-2.5 px-2 rounded-item h-8 text-sm press-flat outline-none focus-visible:ring-[3px] focus-visible:ring-halo';

function GuideSidebarLink({ tab, slug, entry }: GuideSidebarLinkProps) {
	const guide = getGuide(tab, entry);

	if (!guide) {
		return null;
	}

	const Glyph = guide.frontmatter.icon && GUIDE_ICONS[guide.frontmatter.icon];

	return (
		<Link
			to={getGuidePath(guide)}
			data-active={entry === slug}
			className={cn(
				ROW_CLASS,
				entry === slug
					? 'bg-accent text-foreground'
					: 'text-muted-foreground hover:bg-accent/50',
			)}
		>
			{Glyph ? <Glyph size={16} aria-hidden className='shrink-0' /> : null}
			<span className='single-line'>{guide.frontmatter.title}</span>
		</Link>
	);
}

function folderOf(tab: GuideTab, slug: string): GuideFolder | undefined {
	for (const group of GUIDE_NAV[tab].groups) {
		for (const item of group.items) {
			if (typeof item !== 'string' && item.slugs.includes(slug)) {
				return item;
			}
		}
	}
}

/**
 * @description A guide tab's sidebar: each section's heading, then its pages and collapsible folders, the
 * open page highlighted and its folder expanded.
 * @param props The tab and the open page.
 * @returns The sidebar.
 */
function GuideSidebar({ tab, slug }: GuideSidebarProps) {
	const nav = GUIDE_NAV[tab];
	const activeFolder = folderOf(tab, slug)?.label;
	const [openFolders, setOpenFolders] = useState<string[]>(() =>
		activeFolder ? [activeFolder] : [],
	);
	const [shownSlug, setShownSlug] = useState(slug);

	// Every navigation reopens the open page's folder, even one the reader collapsed; other folders keep their state.
	if (slug !== shownSlug) {
		setShownSlug(slug);

		if (activeFolder && !openFolders.includes(activeFolder)) {
			setOpenFolders([...openFolders, activeFolder]);
		}
	}

	return (
		<nav aria-label={nav.label} className='flex flex-col gap-5'>
			{nav.groups.map((group) => (
				<div key={group.label} className='flex flex-col gap-0.5'>
					<p className='px-2 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
						{group.label}
					</p>
					<Accordion
						type='multiple'
						value={openFolders}
						onValueChange={setOpenFolders}
						className='flex flex-col gap-0.5'
					>
						{group.items.map((item) => {
							if (typeof item === 'string') {
								return (
									<GuideSidebarLink
										key={item}
										tab={tab}
										slug={slug}
										entry={item}
									/>
								);
							}

							const Glyph = GUIDE_ICONS[item.icon];

							return (
								<AccordionItem
									key={item.label}
									value={item.label}
									className='border-b-0'
								>
									<AccordionTrigger
										className={cn(
											ROW_CLASS,
											'items-center py-0 font-normal text-muted-foreground hover:bg-accent/50 hover:no-underline',
										)}
									>
										<span className='flex items-center gap-2.5'>
											<Glyph size={16} aria-hidden className='shrink-0' />
											{item.label}
										</span>
									</AccordionTrigger>
									<AccordionContent className='flex flex-col gap-0.5 ml-4 mt-0.5 pb-1 pl-2 border-border border-l'>
										{item.slugs.map((entry) => (
											<GuideSidebarLink
												key={entry}
												tab={tab}
												slug={slug}
												entry={entry}
											/>
										))}
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				</div>
			))}
		</nav>
	);
}

export default GuideSidebar;
