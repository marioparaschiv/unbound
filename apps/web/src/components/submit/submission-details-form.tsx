import type { SubmissionDetailsOverrides } from '@unbound-app/contracts/publish';
import type { SubmissionPreview } from '@unbound-app/contracts/review';
import { IconPaperPlane2 } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { SubmitSection } from '~/components/submit/submit-section';
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
	tags: string;
};

function toDraft(preview: SubmissionPreview): DetailsDraft {
	return { tags: preview.details.tags.join(', ') };
}

function toOverrides(draft: DetailsDraft): SubmissionDetailsOverrides {
	return {
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
			className='min-w-0'
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<SubmitSection
				title='Details'
				description='Read from the repository. Change them here for this submission.'
				footer={
					<Button type='submit' disabled={disabled} className='w-full sm:w-auto'>
						<IconPaperPlane2 size={24} />
						{disabled ? 'Submitting...' : 'Submit for Review'}
					</Button>
				}
			>
				<FieldGroup className='gap-6'>
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
					<FieldError className='whitespace-pre-wrap'>{error}</FieldError>
				</FieldGroup>
			</SubmitSection>
		</form>
	);
}

export default SubmissionDetailsForm;
