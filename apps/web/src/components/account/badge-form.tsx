import {
	BADGE_IMAGE_RULES,
	BADGE_NAME_MAX_LENGTH,
	badgeNameSchema,
} from '@unbound-app/contracts/sponsors';
import { IconCircleWarning, IconPhoto, IconPlus, IconXmark } from 'nucleo-micro-bold';
import type { Badge } from '@unbound-app/contracts/sponsors';

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
} from '~/components/ui/input-group';
import type { BadgeDraft } from '~/components/account/use-badge-drafts';
import { FieldDescription, FieldError } from '~/components/ui/field';
import BadgeTile from '~/components/account/badge-tile';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';

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
		<BadgeTile imageUrl={upload.kind === 'ready' ? upload.imageUrl : undefined}>
			{upload.kind === 'uploading' ? (
				<Spinner />
			) : (
				<IconCircleWarning size={18} className='text-destructive' aria-hidden />
			)}
		</BadgeTile>
	);
}

function DraftRow({ draft, problem, disabled, onReplaceImage, onRename, onRemove }: DraftRowProps) {
	const error = draft.upload.kind === 'rejected' ? draft.upload.problem : problem;

	return (
		<div className='flex flex-col gap-1.5'>
			<div className='flex items-center gap-3'>
				<DraftImage draft={draft} />
				<InputGroup data-disabled={disabled}>
					<InputGroupInput
						value={draft.name}
						onChange={(event) => onRename(draft.id, event.target.value)}
						maxLength={BADGE_NAME_MAX_LENGTH}
						placeholder='Badge name, e.g. Night Owl'
						aria-label='Badge name'
						aria-invalid={
							draft.upload.kind !== 'rejected' && problem ? true : undefined
						}
						disabled={disabled}
					/>
					<InputGroupAddon align='inline-end'>
						<InputGroupText className='tabular-nums'>
							{draft.name.length}/{BADGE_NAME_MAX_LENGTH}
						</InputGroupText>
						<InputGroupButton
							size='sm'
							disabled={disabled}
							onClick={() => onReplaceImage(draft.id)}
						>
							<IconPhoto size={24} />
							Replace
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				{onRemove ? (
					<Button
						type='button'
						variant='outline'
						size='icon'
						aria-label='Remove'
						title='Remove'
						disabled={disabled}
						onClick={() => onRemove(draft.id)}
					>
						<IconXmark size={24} />
					</Button>
				) : null}
			</div>
			{error ? <FieldError className='pl-14'>{error}</FieldError> : null}
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
			className='flex flex-col gap-3'
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

			<div className='flex flex-wrap items-center justify-end gap-x-4 gap-y-3'>
				<FieldDescription className='flex-1 basis-64 text-xs'>
					{BADGE_IMAGE_RULES}. The name is what people see when they tap the badge in
					Discord.
				</FieldDescription>
				<div className='flex gap-2'>
					{onAddMore ? (
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='gap-2'
							disabled={disabled}
							onClick={onAddMore}
						>
							<IconPlus size={14} />
							Add another
						</Button>
					) : null}
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
