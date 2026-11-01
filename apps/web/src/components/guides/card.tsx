import { IconChevronRight } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { GuideIconName } from '~/lib/guides/guide-icon-names';
import { GUIDE_ICONS } from '~/components/guides/guide-icons';
import cn from '~/lib/cn';

type CardProps = {
	title: string;
	icon?: GuideIconName;
	href?: string;
	children?: ReactNode;
};

type CardGroupProps = {
	cols?: number;
	children: ReactNode;
};

const CARD_CLASS =
	'group/card flex flex-col gap-1.5 bg-card p-4 border rounded-surface shadow-surface text-sm';

// Phones always get one column; the docs column is narrow until `xl`, so three columns wait for it.
const COLUMNS: Record<number, string> = {
	2: 'sm:grid-cols-2',
	3: 'sm:grid-cols-2 xl:grid-cols-3',
	4: 'sm:grid-cols-2 xl:grid-cols-4',
};

/**
 * @description A card that names a page and says what it holds; the whole card is the link.
 * @param props The title, its icon, the link target and the summary.
 * @returns The card.
 */
export function Card({ title, icon, href, children }: CardProps) {
	const Glyph = icon && GUIDE_ICONS[icon];
	const body = (
		<>
			{Glyph ? <Glyph size={20} aria-hidden className='mb-1.5 text-primary' /> : null}
			<span className='flex items-center gap-1 font-semibold text-foreground text-base'>
				{title}
				{href ? (
					<IconChevronRight className='size-3.5 text-muted-foreground group-hover/card:translate-x-0.5 transition-transform' />
				) : null}
			</span>
			{children ? (
				<div className='text-muted-foreground [&_p]:text-sm [&_p]:leading-6'>
					{children}
				</div>
			) : null}
		</>
	);
	const linkClass = cn(CARD_CLASS, 'hover:border-primary/40 transition-colors press-flat');

	if (!href) {
		return <div className={CARD_CLASS}>{body}</div>;
	}

	return href.startsWith('/') ? (
		<Link to={href} className={linkClass}>
			{body}
		</Link>
	) : (
		<a href={href} target='_blank' rel='noopener noreferrer' className={linkClass}>
			{body}
		</a>
	);
}

/**
 * @description Lays cards out in a grid that collapses to one column on phones.
 * @param props The column count on wide screens and the cards.
 * @returns The grid.
 */
export function CardGroup({ cols = 2, children }: CardGroupProps) {
	return <div className={cn('gap-3 grid', COLUMNS[cols])}>{children}</div>;
}

export default { Card, CardGroup };
