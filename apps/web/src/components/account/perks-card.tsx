import { IconCheck, IconChevronRight, IconLock } from 'nucleo-micro-bold';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import PerkUpsellDialog from '~/components/account/perk-upsell-dialog';
import { accountOverviewQuery } from '~/queries/account/account';
import BadgeEditor from '~/components/account/badge-editor';
import type { PerkStatus } from '~/lib/sponsors/overview';
import { formatMonthlyPrice } from '~/lib/sponsors/price';
import type { SessionUser } from '~/lib/auth/session';
import { GHOST_ROW } from '~/components/ghost-row';
import Separator from '~/components/ui/separator';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type PerksCardProps = {
	user: SessionUser;
};

type PerkTextProps = {
	perk: PerkStatus;
};

type PerkRowProps = {
	perk: PerkStatus;
	onOpenLocked: (perk: PerkStatus) => void;
};

function PerkText({ perk }: PerkTextProps) {
	return (
		<span className='flex flex-col'>
			<Text as='span' variant='text-sm' className='font-medium'>
				{perk.name}
			</Text>
			<Text as='span' variant='text-xs' color='muted'>
				{perk.description}
			</Text>
		</span>
	);
}

function PerkRow({ perk, onOpenLocked }: PerkRowProps) {
	if (perk.unlocked) {
		return (
			<div className='flex items-center justify-between gap-4'>
				<PerkText perk={perk} />
				<Text variant='text-xs' color='muted' className='flex items-center gap-1 shrink-0'>
					<IconCheck size={14} />
					Unlocked
				</Text>
			</div>
		);
	}

	return (
		<button
			type='button'
			className={cn(GHOST_ROW, 'justify-between gap-4 text-left')}
			onClick={() => onOpenLocked(perk)}
		>
			<PerkText perk={perk} />
			<Text
				as='span'
				variant='text-xs'
				color='muted'
				className='flex items-center gap-1 shrink-0'
			>
				<IconLock size={14} />
				{formatMonthlyPrice(perk.minimumMonthlyCents)}
				<IconChevronRight
					size={14}
					className='transition-transform group-hover:translate-x-0.5'
				/>
			</Text>
		</button>
	);
}

function PerksCard({ user }: PerksCardProps) {
	const { sponsor } = useSuspenseQuery(accountOverviewQuery()).data;
	const [upsell, setUpsell] = useState<PerkStatus | null>(null);
	const badgePerk = sponsor.perks.find((perk) => perk.id === 'custom-badge');
	const showEditor = Boolean(badgePerk && (badgePerk.unlocked || sponsor.badge));

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
					<PerkRow key={perk.id} perk={perk} onOpenLocked={setUpsell} />
				))}

				{badgePerk && showEditor ? (
					<>
						<Separator />
						<BadgeEditor
							claim={sponsor.badge}
							perk={badgePerk}
							editable={badgePerk.unlocked && sponsor.standing === 'active'}
						/>
					</>
				) : null}
			</CardContent>

			<PerkUpsellDialog
				perk={upsell}
				sponsor={sponsor}
				user={user}
				onClose={() => setUpsell(null)}
			/>
		</Card>
	);
}

export default PerksCard;
