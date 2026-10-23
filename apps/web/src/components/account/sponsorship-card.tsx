import { IconExternalLink, IconHeart } from '@tabler/icons-react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { SponsorOverview } from '~/lib/sponsors/overview';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type SponsorshipCardProps = {
	sponsor: SponsorOverview;
};

type SponsorCtaProps = {
	url: string | null;
	label: string;
};

type StandingLabel = {
	label: string;
	variant: 'default' | 'primary' | 'warning';
};

type SponsorshipDetailsProps = {
	sponsor: SponsorOverview;
	sponsorship: NonNullable<SponsorOverview['sponsorship']>;
};

// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const PRICE_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const STANDING_LABELS: Record<SponsorOverview['standing'], StandingLabel> = {
	none: { label: 'Not sponsoring', variant: 'default' },
	active: { label: 'Active', variant: 'primary' },
	grace: { label: 'Ending', variant: 'warning' },
	lapsed: { label: 'Ended', variant: 'default' },
};

function SponsorCta({ url, label }: SponsorCtaProps) {
	if (!url) return null;

	return (
		<Button asChild variant='outline' size='sm' className='gap-2 self-start'>
			<a href={url} target='_blank' rel='noreferrer'>
				<IconHeart size={14} />
				{label}
				<IconExternalLink size={14} />
			</a>
		</Button>
	);
}

function describeAmount(sponsorship: SponsorshipDetailsProps['sponsorship']): string {
	const price = PRICE_FORMAT.format(sponsorship.monthlyPriceCents / 100);

	return sponsorship.oneTime ? `${price} one time` : `${price} a month`;
}

function SponsorshipDetails({ sponsor, sponsorship }: SponsorshipDetailsProps) {
	const standing = STANDING_LABELS[sponsor.standing];
	const pendingEnd =
		sponsorship.state === 'pending_cancellation' && sponsor.standing === 'active'
			? sponsorship.endsAt
			: null;

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex items-center justify-between gap-4'>
				<div className='flex flex-col'>
					<Text variant='text-sm' className='font-medium'>
						{sponsorship.tierName}
					</Text>
					<Text variant='text-xs' color='muted'>
						{describeAmount(sponsorship)}, since {DATE_FORMAT.format(sponsorship.since)}
					</Text>
				</div>
				<Tag variant={standing.variant}>{standing.label}</Tag>
			</div>

			{pendingEnd ? (
				<Text variant='text-xs' color='muted'>
					Your sponsorship ends on {DATE_FORMAT.format(pendingEnd)}.
				</Text>
			) : null}

			{sponsor.graceUntil ? (
				<Text variant='text-xs' color='muted'>
					Your sponsorship has ended. Perks stay until{' '}
					{DATE_FORMAT.format(sponsor.graceUntil)}; sponsor again to keep them.
				</Text>
			) : null}

			{sponsor.standing === 'active' ? null : (
				<SponsorCta url={sponsor.sponsorUrl} label='Sponsor again on GitHub' />
			)}
		</div>
	);
}

function SponsorshipCard({ sponsor }: SponsorshipCardProps) {
	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>GitHub Sponsors</CardTitle>
				<Text variant='text-sm' color='muted' className='mb-2'>
					Sponsoring Unbound on GitHub funds its development and unlocks perks.
				</Text>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{sponsor.sponsorship ? (
					<SponsorshipDetails sponsor={sponsor} sponsorship={sponsor.sponsorship} />
				) : (
					<>
						<Text variant='text-sm' color='muted'>
							{sponsor.githubLinked
								? 'No sponsorship from your GitHub account yet. It shows up here a few moments after you sponsor.'
								: 'Link your GitHub account above so a sponsorship from it reaches this account.'}
						</Text>
						<SponsorCta url={sponsor.sponsorUrl} label='Sponsor on GitHub' />
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default SponsorshipCard;
