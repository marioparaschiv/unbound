import { IconPalette, IconPlug } from 'nucleo-micro-bold';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';
import InstallAddonButton from '~/components/install-addon-button';
import type { MarketplaceAddon } from '~/lib/marketplace-addon';
import AuthorByline from '~/components/author-byline';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type AddonCardProps = ComponentProps<typeof Card> & {
	addon: MarketplaceAddon;
	/** Rendered under the description, such as the addon's tags. */
	details?: ReactNode;
	/** Rendered at the start of the footer, beside the install button. */
	footer?: ReactNode;
};

function AddonCard({ addon, details, footer, className, ...props }: AddonCardProps) {
	return (
		<Card
			className={cn(
				'relative gap-0 p-0 transition-[translate,box-shadow] duration-(--press-duration) ease-spring hover:-translate-y-0.5 hover:shadow-float motion-reduce:hover:translate-y-0',
				className,
			)}
			{...props}
		>
			<CardHeader className='flex flex-row items-start gap-3 p-(--card-pad) pb-0'>
				<div className='flex justify-center items-center bg-accent rounded-control size-10 shrink-0'>
					{addon.type === 'theme' ? (
						<IconPalette className='size-5' />
					) : (
						<IconPlug className='size-5' />
					)}
				</div>
				<div className='flex flex-col flex-1 gap-0.5 min-w-0'>
					<Text variant='heading-sm' className='truncate leading-tight!'>
						{/* The link covers the whole card; the install button sits above it. */}
						<Link
							to='/addons/$id'
							params={{ id: addon.id }}
							className='after:absolute after:inset-0 after:rounded-surface'
						>
							{addon.name}
						</Link>
					</Text>
					<Text as='div' variant='text-xs' color='muted' className='truncate'>
						<AuthorByline authors={addon.authors} prefixed={false} />
					</Text>
				</div>
				<Text variant='text-xs' color='muted' className='self-start mt-1 shrink-0'>
					v{addon.version}
				</Text>
			</CardHeader>
			<CardContent className='flex flex-col gap-3 px-(--card-pad) pt-3 pb-0'>
				<Text variant='text-sm' color='muted' className='line-clamp-2'>
					{addon.description}
				</Text>
				{details}
			</CardContent>
			<CardFooter className='flex flex-wrap items-center gap-3 mt-auto px-(--card-pad) pt-4 pb-(--card-pad)'>
				{footer}
				{/* Phones get a filled primary button whose hit area reaches 44px; wider screens a quiet ghost one. */}
				<InstallAddonButton
					className='sm:hidden z-10 relative after:absolute after:-inset-1.5 ml-auto min-w-36'
					size='sm'
					id={addon.id}
					type={addon.type}
					manifestUrl={addon.manifestUrl}
				/>
				{/* The ghost button's padding bleeds into the card's, so its label lines up with the edges. */}
				<InstallAddonButton
					className='hidden sm:inline-flex z-10 relative -my-2 -mr-3 ml-auto text-foreground'
					size='sm'
					variant='ghost'
					id={addon.id}
					type={addon.type}
					manifestUrl={addon.manifestUrl}
				/>
			</CardFooter>
		</Card>
	);
}

export default AddonCard;
