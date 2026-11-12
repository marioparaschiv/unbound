import { IconExternalLink, IconHeart } from 'nucleo-micro-bold';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { formatMonthlyPrice, formatPrice } from '~/lib/sponsors/price';
import { accountOverviewQuery } from '~/queries/account/account';
import type { SponsorOverview } from '~/lib/sponsors/overview';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type SponsorCtaProps = {
	url: string;
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

const STANDING_LABELS: Record<SponsorOverview['standing'], StandingLabel> = {
	none: { label: 'Not sponsoring', variant: 'default' },
	active: { label: 'Active', variant: 'primary' },
	grace: { label: 'Ending', variant: 'warning' },
	lapsed: { label: 'Ended', variant: 'default' },
};

function SponsorCta({ url, label }: SponsorCtaProps) {
	return (
		<Button asChild variant='sponsor' size='sm' className='gap-2 self-end'>
			<a href={url} target='_blank' rel='noreferrer'>
				<IconHeart size={14} />
				{label}
				<IconExternalLink size={14} />
			</a>
		</Button>
	);
}

function describeAmount(sponsorship: SponsorshipDetailsProps['sponsorship']): string {
	return sponsorship.oneTime
		? `${formatPrice(sponsorship.monthlyPriceCents)} one time`
		: formatMonthlyPrice(sponsorship.monthlyPriceCents);
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

function SponsorshipCard() {
	const { sponsor } = useSuspenseQuery(accountOverviewQuery()).data;
	const active = sponsor.standing === 'active';

	return (
		<Card className='shine-border gap-5'>
			<CardHeader className='gap-3'>
				<div className='flex items-center gap-3'>
					<span className='flex size-7.5 items-center justify-center rounded-[9px] bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_var(--glow)]'>
						<IconHeart size={16} />
					</span>
					<CardTitle>
						{active ? 'Thanks for sponsoring Unbound' : 'Support Unbound'}
					</CardTitle>
				</div>
				<Text
					variant='text-sm'
					color='muted'
					className='max-w-prose leading-relaxed text-pretty'
				>
					{active
						? 'Your sponsorship keeps Unbound free and built in the open. Your perks are active on your Discord profile.'
						: 'Unbound is free and built in the open. Sponsor it on GitHub to keep it going, and from $5 a month, or $30 once for good, get your own badge on your Discord profile, shown to everyone using Unbound.'}
				</Text>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{sponsor.sponsorship ? (
					<SponsorshipDetails sponsor={sponsor} sponsorship={sponsor.sponsorship} />
				) : (
					<>
						<Text variant='text-xs' color='muted' className='leading-relaxed'>
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
