import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import VersionHistory from '~/components/addon/version-history';
import { staggerStyle } from '~/components/motion/reveal-style';
import AddonHeader from '~/components/addon/addon-header';
import AuthorsCard from '~/components/addon/authors-card';
import ScrollShadow from '~/components/ui/scroll-shadow';
import AboutCard from '~/components/addon/about-card';
import AddonMd from '~/components/addon-md';
import Text from '~/components/ui/text';

type AddonPageProps = {
	addon: MarketplaceAddonDetails;
	/** Sits above the header, such as a note that the page is a preview. */
	banner?: ReactNode;
};

/**
 * @description An addon's public page: header, long description, authors, changelog and facts.
 * @param props The addon and an optional banner.
 * @returns The page body.
 */
function AddonPage({ addon, banner }: AddonPageProps) {
	const { source } = addon;
	const sidebar = [
		<AuthorsCard key='authors' authors={addon.authors} />,
		<Card key='changelog' className='gap-4'>
			<CardHeader>
				<CardTitle>What's New</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollShadow
					contentClassName='max-h-96 overflow-y-auto overscroll-contain [scrollbar-width:thin]'
					shadowClassName='inset-x-0 h-10'
					fromClassName='from-card'
				>
					<VersionHistory versions={addon.versions} />
				</ScrollShadow>
			</CardContent>
		</Card>,
		<AboutCard key='about' addon={addon} />,
	].map((card, index) => (
		<div key={card.key} className='min-w-0 animate-reveal' style={staggerStyle(4 + index)}>
			{card}
		</div>
	));

	return (
		<div className='flex flex-col flex-1 gap-8 page-frame'>
			{banner}
			<AddonHeader addon={addon} />

			<div className='items-start gap-6 grid grid-cols-1 lg:grid-cols-3'>
				<Card className='lg:col-span-2 min-w-0 animate-reveal' style={staggerStyle(4)}>
					<CardContent>
						{/* Without an ADDON.md the manifest description stands in, as review and submit tell authors. */}
						{source?.addonMd ? (
							<AddonMd
								source={source.addonMd}
								pin={source.pin}
								mediaBase={source.mediaBase}
								page={source.page}
							/>
						) : (
							<Text variant='text-md' color='muted'>
								{addon.description}
							</Text>
						)}
					</CardContent>
				</Card>
				<aside className='flex flex-col gap-6 min-w-0'>{sidebar}</aside>
			</div>
		</div>
	);
}

export default AddonPage;
