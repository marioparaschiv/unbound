import { IconPalette, IconPlug } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';
import InstallAddonButton from '~/components/install-addon-button';
import type { MarketplaceAddon } from '~/lib/marketplace-addon';
import AuthorByline from '~/components/author-byline';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type AddonCardProps = ComponentProps<typeof Card> & {
	addon: MarketplaceAddon;
};

function AddonCard({ addon, className, ...props }: AddonCardProps) {
	return (
		<Card
			className={cn(
				'relative gap-0 hover:shadow-lg p-0 rounded-lg transition-transform hover:-translate-y-1 duration-200 ease-in-out',
				className,
			)}
			{...props}
		>
			<CardHeader className='flex flex-row items-center gap-3 p-4 pb-0'>
				<div className='flex justify-center items-center bg-accent rounded-lg size-10 shrink-0'>
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
							className='after:absolute after:inset-0 after:rounded-lg'
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
			<CardContent className='flex flex-col gap-3 p-4'>
				<Text variant='text-sm' color='muted' className='line-clamp-2'>
					{addon.description}
				</Text>
			</CardContent>
			<CardFooter className='flex items-center gap-3 mt-auto px-4 pt-0 pb-3'>
				<InstallAddonButton
					className='z-10 relative ml-auto'
					size='icon-sm'
					variant='ghost'
					type={addon.type}
					manifestUrl={addon.manifestUrl}
					iconOnly
				/>
			</CardFooter>
		</Card>
	);
}

export default AddonCard;
