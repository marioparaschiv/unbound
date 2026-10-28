import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import Text from '~/components/ui/text';

type SidebarCardProps = {
	title: string;
	children: ReactNode;
};

type DetailRowProps = {
	label: string;
	children: ReactNode;
};

type ExternalLinkProps = {
	href: string;
	className?: string;
	children: ReactNode;
};

/** A titled card in the addon page's sidebar. */
function SidebarCard({ title, children }: SidebarCardProps) {
	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-2.5'>{children}</CardContent>
		</Card>
	);
}

/** A label on the left, its value on the right. */
function DetailRow({ label, children }: DetailRowProps) {
	return (
		<div className='flex justify-between items-baseline gap-4 min-w-0'>
			<Text variant='text-sm' color='muted' className='shrink-0'>
				{label}
			</Text>
			<Text as='div' variant='text-sm' className='min-w-0 text-right break-words'>
				{children}
			</Text>
		</div>
	);
}

/** A link that leaves the site. */
function ExternalLink({ href, className, children }: ExternalLinkProps) {
	return (
		<a
			href={href}
			target='_blank'
			rel='noopener noreferrer'
			className={
				className ??
				'underline-offset-4 hover:underline decoration-muted-foreground/50 transition-colors'
			}
		>
			{children}
		</a>
	);
}

export { SidebarCard, DetailRow, ExternalLink };

export default { SidebarCard, DetailRow, ExternalLink };
