import { BADGE_IMAGE_TYPE, BADGE_LIMIT } from '@unbound-app/contracts/sponsors';
import type { Badge, BadgeClaim } from '@unbound-app/contracts/sponsors';
import { IconPen, IconTrash, IconUpload } from 'nucleo-micro-bold';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { removeBadgesMutation, saveBadgesMutation } from '~/queries/account/account';
import useBadgeDrafts from '~/components/account/use-badge-drafts';
import type { PerkStatus } from '~/lib/sponsors/overview';
import { formatMonthlyPrice } from '~/lib/sponsors/price';
import UserBadgeList from '~/components/user-badge-list';
import getApiErrorMessage from '~/lib/api/error-message';
import BadgeForm from '~/components/account/badge-form';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type BadgeEditorProps = {
	claim: BadgeClaim | null;
	perk: PerkStatus;
	editable: boolean;
};

type Mode = { kind: 'closed' } | { kind: 'adding' } | { kind: 'editing'; index: number };

const CLOSED: Mode = { kind: 'closed' };

function lockedNote(perk: PerkStatus, editable: boolean): string | null {
	if (!perk.unlocked) {
		return `Your badges are hidden until your sponsorship is ${formatMonthlyPrice(perk.minimumMonthlyCents)} or more.`;
	}

	return editable ? null : 'Sponsor again to change your badges.';
}

function BadgeEditor({ claim, perk, editable }: BadgeEditorProps) {
	const [mode, setMode] = useState<Mode>(CLOSED);
	const addPicker = useRef<HTMLInputElement>(null);
	const replacePicker = useRef<HTMLInputElement>(null);
	// The draft whose image the single-file picker replaces.
	const replacing = useRef<string | null>(null);
	const drafts = useBadgeDrafts();
	const saveBadges = useMutation(saveBadgesMutation());
	const removeBadges = useMutation(removeBadgesMutation());
	const isPending = saveBadges.isPending || removeBadges.isPending;
	const badges = claim?.badges ?? [];
	const note = lockedNote(perk, editable);
	const freeSlots =
		BADGE_LIMIT - badges.length - (mode.kind === 'adding' ? drafts.drafts.length : 0);

	function pickReplacement(id: string) {
		replacing.current = id;
		replacePicker.current?.click();
	}

	function onReplacementPicked(file: File | undefined) {
		if (file && replacing.current) {
			void drafts.replaceImage(replacing.current, file);
		}
	}

	function onAdded(files: File[]) {
		if (files.length > freeSlots) {
			toast.info(
				freeSlots === 1
					? 'One badge slot is free, so only the first image was added.'
					: `${freeSlots} badge slots are free, so only the first ${freeSlots} images were added.`,
			);
		}

		drafts.addFiles(files.slice(0, freeSlots));
		setMode({ kind: 'adding' });
	}

	function close() {
		drafts.clear();
		setMode(CLOSED);
	}

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

	async function saveDrafts(edited: Badge[]) {
		const stored = badges.map(({ name, image }) => ({ name, image }));
		const next =
			mode.kind === 'editing' ? stored.with(mode.index, edited[0]!) : [...stored, ...edited];

		if (
			await save(
				next,
				mode.kind === 'editing'
					? 'Badge saved'
					: edited.length === 1
						? 'Badge added'
						: 'Badges added',
			)
		) {
			close();
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

	const form =
		mode.kind === 'closed' ? null : (
			<BadgeForm
				drafts={drafts.drafts}
				takenNames={badges
					.filter((_, index) => mode.kind !== 'editing' || index !== mode.index)
					.map((badge) => badge.name)}
				disabled={isPending}
				onAddMore={
					mode.kind === 'adding' && freeSlots > 0
						? () => addPicker.current?.click()
						: undefined
				}
				onReplaceImage={pickReplacement}
				onRename={drafts.rename}
				onRemove={
					mode.kind === 'adding'
						? (id) => (drafts.drafts.length === 1 ? close() : drafts.remove(id))
						: undefined
				}
				onCancel={close}
				onSave={(edited) => void saveDrafts(edited)}
			/>
		);

	return (
		<div className='flex flex-col gap-3'>
			<input
				ref={addPicker}
				type='file'
				accept={BADGE_IMAGE_TYPE}
				multiple
				className='hidden'
				onChange={(event) => {
					onAdded([...(event.target.files ?? [])]);
					event.target.value = '';
				}}
			/>
			<input
				ref={replacePicker}
				type='file'
				accept={BADGE_IMAGE_TYPE}
				className='hidden'
				onChange={(event) => {
					onReplacementPicked(event.target.files?.[0]);
					event.target.value = '';
				}}
			/>

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
							isPending || mode.kind !== 'closed' || badges.length >= BADGE_LIMIT
						}
						onClick={() => addPicker.current?.click()}
					>
						<IconUpload size={14} />
						Upload badges
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

			{badges.length === 0 && mode.kind === 'closed' ? (
				<Text variant='text-sm' color='muted'>
					No badges yet. Upload up to {BADGE_LIMIT} PNGs and name each one.
				</Text>
			) : null}

			{editable ? (
				badges.map((badge, index) =>
					mode.kind === 'editing' && mode.index === index ? (
						<div key={badge.image}>{form}</div>
					) : (
						<div
							key={badge.image}
							className='flex items-center justify-between gap-4 min-h-8'
						>
							<div className='flex items-center gap-3 min-w-0'>
								<img
									src={badge.imageUrl}
									alt=''
									width={32}
									height={32}
									className='size-8 shrink-0 object-contain'
								/>
								<Text variant='text-sm' className='truncate'>
									{badge.name}
								</Text>
							</div>
							<div className='flex gap-1'>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='gap-2'
									disabled={isPending || mode.kind !== 'closed'}
									onClick={() => {
										drafts.edit(badge);
										setMode({ kind: 'editing', index });
									}}
								>
									<IconPen size={14} />
									Edit
								</Button>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='gap-2'
									disabled={isPending || mode.kind !== 'closed'}
									onClick={() =>
										void save(
											badges
												.toSpliced(index, 1)
												.map(({ name, image }) => ({ name, image })),
											'Badge removed',
										)
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

			{mode.kind === 'adding' ? form : null}

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
