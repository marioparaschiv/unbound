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
import { SubmitCallout } from '~/components/submit/submit-callout';
import { SubmitSection } from '~/components/submit/submit-section';
import type { ApiErrorDetails } from '~/lib/api/error-details';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import GitHubIcon from '~/components/icons/github';
import RepositoryShortcuts from '~/components/submit/repository-shortcuts';
import Spinner from '~/components/ui/spinner';

type RepositoryPickerProps = {
	defaultValue: string;
	repositories: PushableRepository[];
	disabled: boolean;
	/** The listing this picker asked for is being read. */
	busy: boolean;
	/** Why the last read failed. */
	error: ApiErrorDetails | null;
	/** Called with the repository as `owner/name`. */
	onPick: (repository: string) => void;
};

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
							<SubmitCallout error={error} />
						</Field>
					)}
				</form.Field>

				{repositories.length > 0 ? (
					<form.Subscribe selector={(state) => state.values.repository}>
						{(query) => (
							<RepositoryShortcuts
								repositories={repositories}
								query={query}
								disabled={disabled}
								onPick={pick}
							/>
						)}
					</form.Subscribe>
				) : null}
			</form>
		</SubmitSection>
	);
}

export default RepositoryPicker;
