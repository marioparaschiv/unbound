import { IconArrowUpRight } from 'nucleo-micro-bold';
import { useState } from 'react';

import type { DownloadChannel, DownloadPlatform, Downloads } from '~/lib/downloads/builds';
import PlatformSection from '~/components/download/platform-section';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { staggerStyle } from '~/components/motion/reveal-style';
import { RELEASES_URL } from '~/lib/downloads/install-links';

type DownloadChannelsProps = {
	downloads: Downloads;
};

type ChannelInfo = {
	value: DownloadChannel;
	title: string;
	description: string;
};

const PLATFORMS: DownloadPlatform[] = ['ios', 'android'];

const CHANNELS: ChannelInfo[] = [
	{
		value: 'stable',
		title: 'Stable',
		description: 'Matches Discord on the App Store and Google Play. Pick this if unsure.',
	},
	{
		value: 'nightly',
		title: 'Nightly',
		description: "Built on Discord's TestFlight, beta and alpha. Expect breakage.",
	},
];

/**
 * @description The Stable and Nightly builds behind a toggle, split into an iOS and an Android section.
 * @param props Each channel's newest builds.
 * @returns The download section.
 */
function DownloadChannels({ downloads }: DownloadChannelsProps) {
	const [channel, setChannel] = useState<DownloadChannel>('stable');
	const active = CHANNELS.find((entry) => entry.value === channel) ?? CHANNELS[0];
	const builds = downloads[channel];

	return (
		<section aria-labelledby='downloads-heading' className='flex flex-col gap-8'>
			<div
				className='flex flex-wrap justify-between items-end gap-3 animate-reveal'
				style={staggerStyle(5)}
			>
				<div className='flex flex-col gap-1 max-w-2xl'>
					<h2 id='downloads-heading' className='font-semibold text-foreground text-xl'>
						All downloads
					</h2>
					<p className='text-muted-foreground text-sm'>{active?.description}</p>
				</div>
				<Segmented value={channel} role='tablist'>
					{CHANNELS.map((entry) => (
						<SegmentedItem
							key={entry.value}
							value={entry.value}
							className='text-sm'
							asChild
						>
							<button
								type='button'
								role='tab'
								aria-selected={entry.value === channel}
								onClick={() => setChannel(entry.value)}
							>
								{entry.title}
							</button>
						</SegmentedItem>
					))}
				</Segmented>
			</div>
			{builds.length > 0 ? (
				<div className='flex flex-col gap-10'>
					{PLATFORMS.map((platform) => (
						<PlatformSection
							key={platform}
							platform={platform}
							builds={builds.filter((build) => build.platform === platform)}
						/>
					))}
				</div>
			) : (
				<p className='bg-card p-5 border rounded-surface text-muted-foreground text-sm'>
					Couldn't load builds. Get them from{' '}
					<a
						href={RELEASES_URL}
						target='_blank'
						rel='noopener noreferrer'
						className='inline-flex items-center gap-0.5 text-link underline-offset-4 hover:underline'
					>
						GitHub releases
						<IconArrowUpRight size={12} aria-hidden />
					</a>
					.
				</p>
			)}
		</section>
	);
}

export default DownloadChannels;
