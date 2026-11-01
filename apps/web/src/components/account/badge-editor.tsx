import type { Badge, BadgeClaim } from '@unbound-app/contracts/sponsors';
import { IconPen, IconPlus, IconTrash } from 'nucleo-micro-bold';
import { BADGE_LIMIT } from '@unbound-app/contracts/sponsors';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { removeBadgesMutation, saveBadgesMutation } from '~/queries/account/account';
import type { PerkStatus } from '~/lib/sponsors/overview';
import { formatMonthlyPrice } from '~/lib/sponsors/price';
import UserBadgeList from '~/components/user-badge-list';
import getApiErrorMessage from '~/lib/api/error-message';
import BadgeForm from '~/components/account/badge-form';
import { Button } from '~/components/ui/button';
import UserBadge from '~/components/user-badge';
import Text from '~/components/ui/text';

type BadgeEditorProps = {
	claim: BadgeClaim | null;
	perk: PerkStatus;
	editable: boolean;
};

type Draft = { kind: 'closed' } | { kind: 'adding' } | { kind: 'editing'; index: number };

const NEW_BADGE: Badge = { label: '', icon: 'heart', color: 'pink' };

const CLOSED: Draft = { kind: 'closed' };

function lockedNote(perk: PerkStatus, editable: boolean): string | null {
	if (!perk.unlocked) {
		return `Your badges are hidden until your sponsorship is ${formatMonthlyPrice(perk.minimumMonthlyCents)} or more.`;
	}

	return editable ? null : 'Sponsor again to change your badges.';
}

function BadgeEditor({ claim, perk, editable }: BadgeEditorProps) {
	const [draft, setDraft] = useState<Draft>(CLOSED);
	const saveBadges = useMutation(saveBadgesMutation());
	const removeBadges = useMutation(removeBadgesMutation());
	const isPending = saveBadges.isPending || removeBadges.isPending;
	const badges = claim?.badges ?? [];
	const note = lockedNote(perk, editable);

	async function save(next: Badge[], message: string): Promise<boolean> {
		try {
			if (next.length === 0) {
				await removeBadges.mutateAsync();
			} else {
				await saveBadges.mutateAsync({ badges: next });
			}

			toast.success(message);

			return true;
		} catch (error) {
			toast.error(getApiErrorMessage(error));

			return false;
		}
	}

	if (claim?.revokedAt) {
		return (
			<Text variant='text-sm' color='destructive'>
				Staff removed your badges
				{claim.revokeReason ? `: ${claim.revokeReason}` : '.'} You cannot set others.
			</Text>
		);
	}

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex items-center justify-between gap-4'>
				<div className='flex flex-col'>
					<Text variant='text-sm' className='font-medium'>
						Your badges
					</Text>
					<Text variant='text-xs' color='muted'>
						They show on your Discord profile for everyone using Unbound.
					</Text>
				</div>
				{editable ? (
					<Button
						type='button'
						variant='outline'
						size='sm'
						className='gap-2'
						disabled={
							isPending || draft.kind !== 'closed' || badges.length >= BADGE_LIMIT
						}
						onClick={() => setDraft({ kind: 'adding' })}
					>
						<IconPlus size={14} />
						Add badge
						<span className='text-muted-foreground tabular-nums'>
							{badges.length} of {BADGE_LIMIT}
						</span>
					</Button>
				) : null}
			</div>

			{note ? (
				<Text variant='text-xs' color='muted'>
					{note}
				</Text>
			) : null}

			{badges.length === 0 && draft.kind === 'closed' ? (
				<Text variant='text-sm' color='muted'>
					No badges yet. Add up to {BADGE_LIMIT}.
				</Text>
			) : null}

			{editable ? (
				badges.map((badge, index) =>
					draft.kind === 'editing' && draft.index === index ? (
						<BadgeForm
							key={badge.label}
							initial={badge}
							disabled={isPending}
							onSave={(edited) => save(badges.with(index, edited), 'Badge saved')}
							onCancel={() => setDraft(CLOSED)}
						/>
					) : (
						<div
							key={badge.label}
							className='flex items-center justify-between gap-4 min-h-8'
						>
							<UserBadge badge={badge} />
							<div className='flex gap-1'>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='gap-2'
									disabled={isPending || draft.kind !== 'closed'}
									onClick={() => setDraft({ kind: 'editing', index })}
								>
									<IconPen size={14} />
									Edit
								</Button>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='gap-2'
									disabled={isPending || draft.kind !== 'closed'}
									onClick={() =>
										void save(badges.toSpliced(index, 1), 'Badge removed')
									}
								>
									<IconTrash size={14} />
									Remove
								</Button>
							</div>
						</div>
					),
				)
			) : (
				<UserBadgeList badges={badges} />
			)}

			{draft.kind === 'adding' ? (
				<BadgeForm
					initial={NEW_BADGE}
					disabled={isPending}
					onSave={(added) => save([...badges, added], 'Badge added')}
					onCancel={() => setDraft(CLOSED)}
				/>
			) : null}

			{!editable && badges.length > 0 ? (
				<Button
					type='button'
					variant='outline'
					size='sm'
					className='gap-2 self-start'
					disabled={isPending}
					onClick={() => void save([], 'Badges removed')}
				>
					<IconTrash size={14} />
					Remove badges
				</Button>
			) : null}
		</div>
	);
}

export default BadgeEditor;
