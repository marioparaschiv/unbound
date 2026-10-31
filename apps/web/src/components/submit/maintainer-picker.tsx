import { MAX_SUBMISSION_MAINTAINERS } from '@unbound-app/contracts/publish';
import type { UserSummary } from '@unbound-app/contracts/account';
import { IconUser, IconUserPlus, IconXmark } from 'nucleo-micro-bold';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '~/components/ui/input-group';
import { FieldDescription, FieldError } from '~/components/ui/field';
import { userQuery } from '~/queries/submissions/submissions';
import getApiErrorMessage from '~/lib/api/error-message';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';

type MaintainerPickerProps = {
	id: string;
	/** The maintainers besides the owners, in the order they were added. */
	value: UserSummary[];
	onChange: (value: UserSummary[]) => void;
	/** The author owns the addon, so they may add and remove maintainers. */
	editable: boolean;
	disabled: boolean;
};

type MaintainerRowProps = {
	maintainer: UserSummary;
	/** `null` when the author may not remove maintainers. */
	onRemove: (() => void) | null;
	disabled: boolean;
};

function MaintainerRow({ maintainer, onRemove, disabled }: MaintainerRowProps) {
	return (
		<li className='flex items-center gap-3 hover:bg-accent/40 px-2 py-1.5 rounded-control transition-colors'>
			<UserAvatar src={maintainer.image} name={maintainer.name} size='sm' />
			<span className='flex flex-col flex-1 min-w-0'>
				<Text as='span' variant='text-sm' className='font-medium truncate'>
					{maintainer.name}
				</Text>
				<Text as='span' variant='text-xs' color='muted' className='font-mono truncate'>
					{maintainer.id}
				</Text>
			</span>
			{onRemove ? (
				<Button
					type='button'
					variant='ghost'
					size='icon-sm'
					aria-label={`Remove ${maintainer.name}`}
					disabled={disabled}
					onClick={onRemove}
				>
					<IconXmark size={14} />
				</Button>
			) : null}
		</li>
	);
}

/** Lists the addon's maintainers besides its owners; an owner adds them by user ID and removes them. */
function MaintainerPicker({ id, value, onChange, editable, disabled }: MaintainerPickerProps) {
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const full = value.length >= MAX_SUBMISSION_MAINTAINERS;

	async function add() {
		const userId = draft.trim();

		if (!userId || adding) return;

		if (value.some((maintainer) => maintainer.id === userId)) {
			setError('That user is already a maintainer.');

			return;
		}

		setAdding(true);

		try {
			const found = await queryClient.fetchQuery(userQuery(userId));

			if (!found) {
				setError(`No user has the ID ${userId}.`);

				return;
			}

			onChange([...value, found]);
			setDraft('');
			setError(null);
		} catch (cause) {
			setError(getApiErrorMessage(cause));
		} finally {
			setAdding(false);
		}
	}

	return (
		<div className='flex flex-col gap-3'>
			{value.length > 0 ? (
				<ul className='flex flex-col -mx-2'>
					{value.map((maintainer) => (
						<MaintainerRow
							key={maintainer.id}
							maintainer={maintainer}
							disabled={disabled}
							onRemove={
								editable
									? () =>
											onChange(
												value.filter((entry) => entry.id !== maintainer.id),
											)
									: null
							}
						/>
					))}
				</ul>
			) : (
				<Text variant='text-sm' color='muted'>
					{editable
						? 'Only you can publish updates.'
						: 'No maintainers besides the owners.'}
				</Text>
			)}

			{editable ? (
				<>
					<InputGroup data-disabled={disabled || full}>
						<InputGroupAddon>
							<IconUser />
						</InputGroupAddon>
						<InputGroupInput
							id={id}
							value={draft}
							onChange={(event) => {
								setDraft(event.target.value);
								setError(null);
							}}
							onKeyDown={(event) => {
								// Enter adds the user instead of submitting the whole form.
								if (event.key !== 'Enter') return;

								event.preventDefault();
								void add();
							}}
							placeholder='User ID'
							aria-invalid={error ? true : undefined}
							className='font-mono'
							disabled={disabled || full}
						/>
						<InputGroupAddon align='inline-end'>
							<InputGroupButton
								disabled={disabled || full || adding || !draft.trim()}
								onClick={() => void add()}
							>
								{adding ? <Spinner /> : <IconUserPlus size={24} />}
								Add
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
					<FieldError>{error}</FieldError>
					<FieldDescription>
						{full
							? `An addon can have at most ${MAX_SUBMISSION_MAINTAINERS} maintainers besides its owners.`
							: 'Maintainers can publish updates. People find their User ID on their dashboard.'}
					</FieldDescription>
				</>
			) : (
				<FieldDescription>
					Only the addon’s owners can change its maintainers.
				</FieldDescription>
			)}
		</div>
	);
}

export default MaintainerPicker;
