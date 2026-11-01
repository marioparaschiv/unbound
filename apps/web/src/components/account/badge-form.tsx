import {
	BADGE_IMAGE_RULES,
	BADGE_NAME_MAX_LENGTH,
	badgeNameSchema,
} from '@unbound-app/contracts/sponsors';
import { IconCircleWarning, IconPhoto, IconPlus, IconXmark } from 'nucleo-micro-bold';
import type { Badge } from '@unbound-app/contracts/sponsors';

import type { BadgeDraft } from '~/components/account/use-badge-drafts';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type BadgeFormProps = {
	drafts: BadgeDraft[];
	/** Names of the saved badges the drafts sit beside, which a draft must not repeat. */
	takenNames: string[];
	disabled: boolean;
	/** Opens the picker for more PNGs; absent when no slot is left or a single badge is edited. */
	onAddMore?: () => void;
	onReplaceImage: (id: string) => void;
	onRename: (id: string, name: string) => void;
	/** Absent when editing one badge, where Cancel discards it. */
	onRemove?: (id: string) => void;
	onCancel: () => void;
	onSave: (badges: Badge[]) => void;
};

type DraftRowProps = Pick<
	BadgeFormProps,
	'disabled' | 'onReplaceImage' | 'onRename' | 'onRemove'
> & {
	draft: BadgeDraft;
	problem: string | undefined;
};

function findNameProblem(name: string, taken: Set<string>): string | undefined {
	const parsed = badgeNameSchema.safeParse(name);

	if (!parsed.success) {
		return name.trim() ? parsed.error.issues[0]?.message : 'Give the badge a name.';
	}

	if (taken.has(parsed.data.toLowerCase())) {
		return `You already have a badge called "${parsed.data}".`;
	}
}

function DraftImage({ draft }: { draft: BadgeDraft }) {
	const { upload } = draft;

	return (
		<span className='grid size-8 shrink-0 place-items-center rounded-item bg-muted text-muted-foreground'>
			{upload.kind === 'ready' ? (
				<img
					src={upload.imageUrl}
					alt=''
					width={32}
					height={32}
					className='size-8 object-contain'
				/>
			) : upload.kind === 'uploading' ? (
				<Spinner />
			) : (
				<IconCircleWarning size={16} className='text-destructive' aria-hidden />
			)}
		</span>
	);
}

function DraftRow({ draft, problem, disabled, onReplaceImage, onRename, onRemove }: DraftRowProps) {
	const error = draft.upload.kind === 'rejected' ? draft.upload.problem : problem;

	return (
		<div className='flex flex-col gap-1.5'>
			<div className='flex items-center gap-2'>
				<DraftImage draft={draft} />
				<Input
					value={draft.name}
					onChange={(event) => onRename(draft.id, event.target.value)}
					maxLength={BADGE_NAME_MAX_LENGTH}
					placeholder='Badge name, e.g. Night Owl'
					aria-label='Badge name'
					disabled={disabled}
				/>
				<Text
					variant='text-xs'
					color='muted'
					className='w-10 shrink-0 text-right tabular-nums'
				>
					{draft.name.length}/{BADGE_NAME_MAX_LENGTH}
				</Text>
				<Button
					type='button'
					variant='ghost'
					size='icon-sm'
					aria-label='Choose another image'
					title='Choose another image'
					disabled={disabled}
					onClick={() => onReplaceImage(draft.id)}
				>
					<IconPhoto size={14} />
				</Button>
				{onRemove ? (
					<Button
						type='button'
						variant='ghost'
						size='icon-sm'
						aria-label='Remove'
						title='Remove'
						disabled={disabled}
						onClick={() => onRemove(draft.id)}
					>
						<IconXmark size={14} />
					</Button>
				) : null}
			</div>
			{error ? (
				<Text variant='text-xs' color='destructive'>
					{error}
				</Text>
			) : null}
		</div>
	);
}

/** Names and images for one or more badges, saved together. */
function BadgeForm({
	drafts,
	takenNames,
	disabled,
	onAddMore,
	onReplaceImage,
	onRename,
	onRemove,
	onCancel,
	onSave,
}: BadgeFormProps) {
	const taken = new Set(takenNames.map((name) => name.toLowerCase()));
	const problems = drafts.map((draft) => {
		const problem = findNameProblem(draft.name, taken);

		taken.add(draft.name.trim().toLowerCase());

		return problem;
	});
	const badges = drafts.flatMap(({ name, upload }) =>
		upload.kind === 'ready' ? [{ name: name.trim(), image: upload.image }] : [],
	);
	const ready = badges.length === drafts.length && problems.every((problem) => !problem);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();

				if (ready) {
					onSave(badges);
				}
			}}
			className='flex flex-col gap-3 rounded-control border p-3'
		>
			{drafts.map((draft, index) => (
				<DraftRow
					key={draft.id}
					draft={draft}
					problem={problems[index]}
					disabled={disabled}
					onReplaceImage={onReplaceImage}
					onRename={onRename}
					onRemove={onRemove}
				/>
			))}

			<Text variant='text-xs' color='muted'>
				{BADGE_IMAGE_RULES}. The name is what people see when they tap the badge in Discord.
			</Text>

			<div className='flex items-center justify-between gap-2'>
				{onAddMore ? (
					<Button
						type='button'
						variant='ghost'
						size='sm'
						className='gap-2'
						disabled={disabled}
						onClick={onAddMore}
					>
						<IconPlus size={14} />
						Add another
					</Button>
				) : (
					<span />
				)}
				<div className='flex gap-2'>
					<Button
						type='button'
						variant='outline'
						size='sm'
						disabled={disabled}
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button type='submit' size='sm' disabled={disabled || !ready}>
						Save
					</Button>
				</div>
			</div>
		</form>
	);
}

export default BadgeForm;
