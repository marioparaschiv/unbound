import type { PushableRepository } from '@unbound-app/contracts/source';
import { repositoryInputSchema } from '@unbound-app/contracts/source';
import { IconMagnifier } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '~/components/ui/input-group';
import { SubmitSection } from '~/components/submit/submit-section';
import { repositoryAddonsQuery } from '~/queries/submissions/submissions';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import GitHubIcon from '~/components/icons/github';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';

type RepositoryPickerProps = {
	defaultValue: string;
	repositories: PushableRepository[];
	disabled: boolean;
	/** The listing this picker asked for is being read. */
	busy: boolean;
	/** Why the last read failed. */
	error: string | null;
	/** Called with the repository as `owner/name`. */
	onPick: (repository: string) => void;
};

type RepositoryShortcutProps = {
	repository: string;
	disabled: boolean;
	onPick: () => void;
};

function RepositoryShortcut({ repository, disabled, onPick }: RepositoryShortcutProps) {
	const prefetch = usePrefetchIntent(repositoryAddonsQuery({ repository }));

	return (
		<Button
			type='button'
			variant='outline'
			size='sm'
			disabled={disabled}
			onClick={onPick}
			{...prefetch}
		>
			<GitHubIcon />
			{repository}
		</Button>
	);
}

function RepositoryPicker({
	defaultValue,
	repositories,
	disabled,
	busy,
	error,
	onPick,
}: RepositoryPickerProps) {
	const id = useId();
	const form = useForm({
		defaultValues: { repository: defaultValue },
		onSubmit: ({ value }) => onPick(repositoryInputSchema.parse(value.repository)),
	});

	function pick(repository: string) {
		form.setFieldValue('repository', repository);
		void form.handleSubmit();
	}

	return (
		<SubmitSection
			title='Repository'
			description='A public GitHub repository you can push to, as a URL or owner/name. The built bundle must be committed.'
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
				className='flex flex-col gap-4'
			>
				<form.Field name='repository' validators={{ onSubmit: repositoryInputSchema }}>
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={`${id}-repository`} className='sr-only'>
								Repository
							</FieldLabel>
							<InputGroup>
								<InputGroupAddon>
									<GitHubIcon />
								</InputGroupAddon>
								<InputGroupInput
									id={`${id}-repository`}
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									placeholder='owner/name'
									aria-invalid={field.state.meta.errors.length > 0}
									disabled={disabled}
									required
								/>
								<InputGroupAddon align='inline-end'>
									<InputGroupButton
										type='submit'
										size='sm'
										disabled={disabled || !field.state.value.trim()}
									>
										{busy ? <Spinner /> : <IconMagnifier size={24} />}
										Find addons
									</InputGroupButton>
								</InputGroupAddon>
							</InputGroup>
							<FieldError errors={field.state.meta.errors} />
							<FieldError className='whitespace-pre-wrap'>{error}</FieldError>
						</Field>
					)}
				</form.Field>

				{repositories.length > 0 ? (
					<div className='flex flex-col gap-2'>
						<Text variant='text-xs' color='muted'>
							Repositories you can push to
						</Text>
						<div className='flex flex-wrap gap-2'>
							{repositories.map((entry) => (
								<RepositoryShortcut
									key={entry.repository}
									repository={entry.repository}
									disabled={disabled}
									onPick={() => pick(entry.repository)}
								/>
							))}
						</div>
					</div>
				) : null}
			</form>
		</SubmitSection>
	);
}

export default RepositoryPicker;
