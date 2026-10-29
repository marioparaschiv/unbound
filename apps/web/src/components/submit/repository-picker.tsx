import type { PushableRepository } from '@unbound-app/contracts/source';
import { repositoryInputSchema } from '@unbound-app/contracts/source';
import { IconMagnifier } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import { repositoryAddonsQuery } from '~/queries/submissions/submissions';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import GitHubIcon from '~/components/icons/github';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type RepositoryPickerProps = {
	defaultValue: string;
	repositories: PushableRepository[];
	disabled: boolean;
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
			variant='ghost'
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

function RepositoryPicker({ defaultValue, repositories, disabled, onPick }: RepositoryPickerProps) {
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
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
			className='flex flex-col gap-3'
		>
			<form.Field name='repository' validators={{ onSubmit: repositoryInputSchema }}>
				{(field) => (
					<Field data-invalid={field.state.meta.errors.length > 0}>
						<FieldLabel htmlFor={`${id}-repository`}>Repository</FieldLabel>
						<div className='flex gap-2'>
							<Input
								id={`${id}-repository`}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								placeholder='https://github.com/owner/name'
								aria-invalid={field.state.meta.errors.length > 0}
								disabled={disabled}
								required
							/>
							<Button
								type='submit'
								variant='outline'
								disabled={disabled || !field.state.value.trim()}
							>
								<IconMagnifier size={24} />
								Find addons
							</Button>
						</div>
						<FieldDescription>
							A public GitHub repository you can push to, as a URL or owner/name. The
							bundle must be committed.
						</FieldDescription>
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>

			{repositories.length > 0 ? (
				<div className='flex flex-col gap-1'>
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
	);
}

export default RepositoryPicker;
