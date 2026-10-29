import InstallAddonButton from '~/components/install-addon-button';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import { staggerStyle } from '~/components/motion/reveal-style';
import BlurReveal from '~/components/motion/blur-reveal';
import { formatDate } from '~/components/addon/format';
import AddonIcon from '~/components/addon-icon';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type AddonHeaderProps = {
	addon: MarketplaceAddonDetails;
};

/** The addon's identity, install button and repository tags. */
function AddonHeader({ addon }: AddonHeaderProps) {
	const tags = addon.source?.details.tags ?? [];
	const [latest] = addon.versions;

	return (
		<header className='flex flex-col gap-4'>
			<div className='flex sm:flex-row flex-col sm:items-center gap-4'>
				<div
					className='flex justify-center items-center bg-accent border rounded-surface size-16 shrink-0 animate-reveal'
					style={staggerStyle(0)}
				>
					<AddonIcon type={addon.type} svg={addon.iconSvg} className='size-8' />
				</div>
				<div className='flex flex-col flex-1 gap-1.5 min-w-0'>
					<Text as='h1' variant='heading-lg' className='truncate'>
						<BlurReveal text={addon.name} />
					</Text>
					<Text
						as='div'
						variant='text-sm'
						color='muted'
						className='flex flex-wrap gap-1.5 animate-reveal'
						style={staggerStyle(1)}
					>
						<span>v{addon.version}</span>
						{latest ? <span>· Updated {formatDate(latest.publishedAt)}</span> : null}
					</Text>
				</div>
				<div className='max-sm:hidden animate-reveal' style={staggerStyle(2)}>
					<InstallAddonButton
						size='lg'
						id={addon.id}
						type={addon.type}
						manifestUrl={addon.manifestUrl}
					/>
				</div>
			</div>
			{/* Without an ADDON.md the page's main card shows the description, so it isn't repeated here. */}
			{addon.source?.addonMd ? (
				<Text
					variant='text-md'
					color='muted'
					className='max-w-3xl animate-reveal'
					style={staggerStyle(2)}
				>
					{addon.description}
				</Text>
			) : null}
			{tags.length > 0 ? (
				<ul
					className='flex flex-wrap gap-1.5 animate-reveal'
					style={staggerStyle(3)}
					aria-label='Tags'
				>
					{tags.map((tag) => (
						<li key={tag}>
							<Tag className='px-2 py-1 text-xs capitalize'>{tag}</Tag>
						</li>
					))}
				</ul>
			) : null}
			{/* Phones get the button full width under the description, right above the ADDON.md. */}
			<div className='sm:hidden animate-reveal' style={staggerStyle(3)}>
				<InstallAddonButton
					size='lg'
					className='w-full'
					id={addon.id}
					type={addon.type}
					manifestUrl={addon.manifestUrl}
				/>
			</div>
		</header>
	);
}

export default AddonHeader;
