import { Link } from '@tanstack/react-router';

import { GUIDE_NAV, type GuideTab } from '~/lib/guides/guide-nav';
import { getGuide, getGuidePath } from '~/lib/guides/guides';
import cn from '~/lib/cn';

type GuideSidebarProps = {
	tab: GuideTab;
	/** The open page. */
	slug: string;
};

/**
 * @description A guide tab's sidebar: each group's label, then its pages, the open one highlighted.
 * @param props The tab and the open page.
 * @returns The sidebar.
 */
function GuideSidebar({ tab, slug }: GuideSidebarProps) {
	const nav = GUIDE_NAV[tab];

	return (
		<nav aria-label={nav.label} className='flex flex-col gap-5'>
			{nav.groups.map((group) => (
				<div key={group.label} className='flex flex-col gap-0.5'>
					<p className='px-2 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
						{group.label}
					</p>
					{group.slugs.flatMap((entry) => {
						const guide = getGuide(tab, entry);

						if (!guide) {
							return [];
						}

						return (
							<Link
								key={entry}
								to={getGuidePath(guide)}
								data-active={entry === slug}
								className={cn(
									'flex items-center px-2 rounded-item h-8 text-sm press-flat hover:bg-accent',
									entry === slug
										? 'bg-accent text-foreground font-semibold'
										: 'text-muted-foreground',
								)}
							>
								<span className='single-line'>{guide.frontmatter.title}</span>
							</Link>
						);
					})}
				</div>
			))}
		</nav>
	);
}

export default GuideSidebar;
