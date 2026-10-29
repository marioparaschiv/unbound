import type { SubmissionDetailsOverrides } from '@unbound-app/contracts/publish';
import type { SubmissionPreview } from '@unbound-app/contracts/review';
import { IconPaperPlane2 } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';

type SubmissionDetailsFormProps = {
	/** Its details are the form's starting values. */
	preview: SubmissionPreview;
	error: string | null;
	disabled: boolean;
	onSubmit: (details: SubmissionDetailsOverrides) => void;
};

type DetailsDraft = {
	homepage: string;
	tags: string;
};

function toDraft(preview: SubmissionPreview): DetailsDraft {
	return { homepage: preview.details.homepage ?? '', tags: preview.details.tags.join(', ') };
}

function toOverrides(draft: DetailsDraft): SubmissionDetailsOverrides {
	return {
		homepage: draft.homepage.trim() || null,
		tags: draft.tags
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean),
	};
}

function SubmissionDetailsForm({ preview, error, disabled, onSubmit }: SubmissionDetailsFormProps) {
	const id = useId();
	const form = useForm({
		defaultValues: toDraft(preview),
		onSubmit: ({ value }) => onSubmit(toOverrides(value)),
	});

	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name='homepage'>
					{(field) => (
						<Field>
							<FieldLabel htmlFor={`${id}-homepage`}>Homepage</FieldLabel>
							<Input
								id={`${id}-homepage`}
								type='url'
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								placeholder='https://'
								disabled={disabled}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name='tags'>
					{(field) => (
						<Field>
							<FieldLabel htmlFor={`${id}-tags`}>Tags</FieldLabel>
							<Input
								id={`${id}-tags`}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								disabled={disabled}
							/>
							<FieldDescription>
								Comma-separated. Defaults to the repository’s topics.
							</FieldDescription>
						</Field>
					)}
				</form.Field>
			</FieldGroup>

			<FieldError className='whitespace-pre-wrap'>{error}</FieldError>

			<Button type='submit' disabled={disabled} className='w-full md:w-auto md:self-start'>
				<IconPaperPlane2 size={24} />
				{disabled ? 'Submitting...' : 'Submit for Review'}
			</Button>
		</form>
	);
}

export default SubmissionDetailsForm;
