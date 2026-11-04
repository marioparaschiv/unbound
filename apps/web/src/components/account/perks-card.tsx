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
	// "Custom badge" reads "Custom badges" once the user has set more than one.
	const plural = (sponsor.badge?.badges.length ?? 0) > 1;
	const perks = sponsor.perks.map((perk) =>
		perk.id === 'custom-badge' && plural ? { ...perk, name: `${perk.name}s` } : perk,
	);
	const badgePerk = perks.find((perk) => perk.id === 'custom-badge');
	const showEditor = Boolean(badgePerk && (badgePerk.unlocked || sponsor.badge));
	// While badges are editable, the editor shows the perk itself, with the upload button as its status.
	const editorOwnsRow = Boolean(showEditor && badgePerk?.claimable);

	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>Sponsor Perks</CardTitle>
				<Text variant='text-sm' color='muted' className='mb-2'>
					Perks unlock while you sponsor and stay for a short grace period after it ends.
				</Text>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{perks.map((perk) =>
					perk === badgePerk && editorOwnsRow ? null : (
						<PerkRow key={perk.id} perk={perk} onOpenLocked={setUpsell} />
					),
				)}

				{badgePerk && showEditor ? (
					<BadgeEditor
						claim={sponsor.badge}
						perk={badgePerk}
						editable={badgePerk.claimable}
						heading={<PerkText perk={badgePerk} />}
					/>
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
