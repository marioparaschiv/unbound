import { IconExternalLink, IconHeart } from 'nucleo-micro-bold';
import type { Badge } from '@unbound-app/contracts/sponsors';

import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '~/components/ui/dialog';
import DiscordProfilePreview from '~/components/account/discord-profile-preview';
import type { PerkStatus, SponsorOverview } from '~/lib/sponsors/overview';
import { formatMonthlyPrice } from '~/lib/sponsors/price';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type PerkUpsellDialogProps = {
	perk: PerkStatus | null;
	sponsor: SponsorOverview;
	user: { name: string; image: string | null };
	onClose: () => void;
};

const SAMPLE_BADGES: Badge[] = [
	{ label: 'Night Owl', icon: 'moon', color: 'purple' },
	{ label: 'Theme Fan', icon: 'palette', color: 'teal' },
	{ label: 'Early Supporter', icon: 'heart', color: 'pink' },
];

function tierNote(perk: PerkStatus, sponsor: SponsorOverview): string {
	const tier = formatMonthlyPrice(perk.minimumMonthlyCents);
	const current = sponsor.sponsorship;

	if (sponsor.standing === 'active' && current && !current.oneTime) {
		return `Thanks for sponsoring ${formatMonthlyPrice(current.monthlyPriceCents)}. Moving to ${tier} unlocks this.`;
	}

	return `Sponsoring Unbound on GitHub at ${tier} or more unlocks this, and helps keep Unbound going.`;
}

/** Shows what a locked perk looks like and the tier that unlocks it. */
function PerkUpsellDialog({ perk, sponsor, user, onClose }: PerkUpsellDialogProps) {
	const stored = sponsor.badge?.badges ?? [];

	return (
		<Dialog open={perk !== null} onOpenChange={(open) => (open ? null : onClose())}>
			{perk ? (
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<div className='flex items-center gap-2'>
							<DialogTitle>{perk.name}</DialogTitle>
							<Tag variant='primary'>
								{formatMonthlyPrice(perk.minimumMonthlyCents)}
							</Tag>
						</div>
						<DialogDescription>{perk.description}</DialogDescription>
					</DialogHeader>

					<DiscordProfilePreview
						name={user.name}
						image={user.image}
						badges={stored.length > 0 ? stored : SAMPLE_BADGES}
					/>

					<Text variant='text-sm' color='muted'>
						{tierNote(perk, sponsor)}
					</Text>

					<DialogFooter>
						<DialogClose asChild>
							<Button variant='outline'>Not now</Button>
						</DialogClose>
						{sponsor.sponsorUrl ? (
							<Button asChild className='gap-2'>
								<a href={sponsor.sponsorUrl} target='_blank' rel='noreferrer'>
									<IconHeart size={14} />
									Sponsor on GitHub
									<IconExternalLink size={14} />
								</a>
							</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			) : null}
		</Dialog>
	);
}

export default PerkUpsellDialog;
