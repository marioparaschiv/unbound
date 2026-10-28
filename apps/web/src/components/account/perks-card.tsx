import {
	BADGE_COLORS,
	BADGE_ICONS,
	BADGE_LABEL_MAX_LENGTH,
	badgeClaimResponseSchema,
	badgeLabelSchema,
} from '@unbound-app/contracts/sponsors';
import type { Badge, BadgeClaim } from '@unbound-app/contracts/sponsors';
import { IconCheck, IconLock, IconTrash } from 'nucleo-micro-bold';
import { useRouter } from '@tanstack/react-router';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import UserBadge, { BADGE_COLOR_CLASSES, BADGE_ICON_COMPONENTS } from '~/components/user-badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { PerkStatus, SponsorOverview } from '~/lib/sponsors/overview';
import { createBrowserClient } from '~/lib/api/browser-client';
import getApiErrorMessage from '~/lib/api/error-message';
import Separator from '~/components/ui/separator';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type PerksCardProps = {
	sponsor: SponsorOverview;
};

type PerkRowProps = {
	perk: PerkStatus;
};

type BadgeEditorProps = {
	claim: BadgeClaim | null;
	editable: boolean;
};

const DEFAULT_BADGE: Badge = { label: '', icon: 'heart', color: 'pink' };

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

function BadgeEditor({ claim, editable }: BadgeEditorProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [badge, setBadge] = useState<Badge>(
		claim ? { label: claim.label, icon: claim.icon, color: claim.color } : DEFAULT_BADGE,
	);
	const label = badgeLabelSchema.safeParse(badge.label);
	const disabled = isPending || !editable;

	function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		startTransition(async () => {
			try {
				await createBrowserClient()('PUT /api/v1/me/badge', {
					body: badge,
					response: badgeClaimResponseSchema,
				});
				await router.invalidate();
				toast.success('Badge saved');
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}
		});
	}

	function remove() {
		startTransition(async () => {
			try {
				await createBrowserClient()('DELETE /api/v1/me/badge', {
					response: badgeClaimResponseSchema,
				});
				setBadge(DEFAULT_BADGE);
				await router.invalidate();
				toast.success('Badge removed');
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}
		});
	}

	if (claim?.revokedAt) {
		return (
			<Text variant='text-sm' color='destructive'>
				Staff removed your badge
				{claim.revokeReason ? `: ${claim.revokeReason}` : '.'} You cannot set another.
			</Text>
		);
	}

	return (
		<form onSubmit={save} className='flex flex-col gap-4'>
			<div className='flex flex-col gap-1.5'>
				<div className='flex gap-2 items-center'>
					<Input
						value={badge.label}
						onChange={(event) => setBadge({ ...badge, label: event.target.value })}
						maxLength={BADGE_LABEL_MAX_LENGTH}
						placeholder='Badge label, e.g. Night Owl'
						aria-label='Badge label'
						disabled={disabled}
					/>
					<Text variant='text-xs' color='muted' className='tabular-nums shrink-0'>
						{badge.label.length}/{BADGE_LABEL_MAX_LENGTH}
					</Text>
				</div>
				{badge.label && !label.success ? (
					<Text variant='text-xs' color='destructive'>
						{label.error.issues[0]?.message}
					</Text>
				) : null}
			</div>

			<div className='flex flex-wrap gap-1.5' role='radiogroup' aria-label='Badge icon'>
				{BADGE_ICONS.map((icon) => {
					const IconComponent = BADGE_ICON_COMPONENTS[icon];

					return (
						<Button
							key={icon}
							type='button'
							size='icon-sm'
							variant={badge.icon === icon ? 'default' : 'outline'}
							role='radio'
							aria-checked={badge.icon === icon}
							aria-label={icon}
							disabled={disabled}
							onClick={() => setBadge({ ...badge, icon })}
						>
							<IconComponent size={16} />
						</Button>
					);
				})}
			</div>

			<div className='flex flex-wrap gap-2' role='radiogroup' aria-label='Badge colour'>
				{BADGE_COLORS.map((color) => (
					<button
						key={color}
						type='button'
						role='radio'
						aria-checked={badge.color === color}
						aria-label={color}
						disabled={disabled}
						onClick={() => setBadge({ ...badge, color })}
						className={cn(
							'size-7 rounded-full border-2 border-transparent disabled:opacity-50',
							BADGE_COLOR_CLASSES[color],
							badge.color === color && 'border-foreground',
						)}
					/>
				))}
			</div>

			<div className='flex items-center justify-between gap-4'>
				<div className='flex items-center gap-2 min-w-0'>
					<Text variant='text-xs' color='muted'>
						Preview
					</Text>
					{label.success ? <UserBadge badge={{ ...badge, label: label.data }} /> : null}
				</div>
				<div className='flex gap-2'>
					{claim ? (
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='gap-2'
							disabled={isPending}
							onClick={remove}
						>
							<IconTrash size={14} />
							Remove
						</Button>
					) : null}
					<Button type='submit' size='sm' disabled={disabled || !label.success}>
						Save
					</Button>
				</div>
			</div>
		</form>
	);
}

function PerksCard({ sponsor }: PerksCardProps) {
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
