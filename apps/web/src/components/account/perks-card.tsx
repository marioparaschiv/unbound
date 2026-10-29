import { useSuspenseQuery } from '@tanstack/react-query';
import { IconCheck, IconLock } from 'nucleo-micro-bold';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { accountOverviewQuery } from '~/queries/account/account';
import BadgeEditor from '~/components/account/badge-editor';
import type { PerkStatus } from '~/lib/sponsors/overview';
import Separator from '~/components/ui/separator';
import Text from '~/components/ui/text';

type PerkRowProps = {
	perk: PerkStatus;
};

function PerkRow({ perk }: PerkRowProps) {
	return (
		<div className='flex items-center justify-between gap-4'>
			<div className='flex flex-col'>
				<Text variant='text-sm' className='font-medium'>
					{perk.name}
				</Text>
				<Text variant='text-xs' color='muted'>
					{perk.description}
				</Text>
			</div>
			<Text variant='text-xs' color='muted' className='flex items-center gap-1 shrink-0'>
				{perk.unlocked ? <IconCheck size={14} /> : <IconLock size={14} />}
				{perk.unlocked ? 'Unlocked' : 'Locked'}
			</Text>
		</div>
	);
}

function PerksCard() {
	const { sponsor } = useSuspenseQuery(accountOverviewQuery()).data;
	const badgePerk = sponsor.perks.find((perk) => perk.id === 'custom-badge');
	const showEditor = Boolean(badgePerk?.unlocked || sponsor.badge);

	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>Sponsor Perks</CardTitle>
				<Text variant='text-sm' color='muted' className='mb-2'>
					Perks unlock while you sponsor and stay for a short grace period after it ends.
				</Text>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{sponsor.perks.map((perk) => (
					<PerkRow key={perk.id} perk={perk} />
				))}

				{showEditor ? (
					<>
						<Separator />
						<BadgeEditor
							claim={sponsor.badge}
							editable={Boolean(badgePerk?.unlocked) && sponsor.standing === 'active'}
						/>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}

export default PerksCard;
