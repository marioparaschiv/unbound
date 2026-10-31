import type { SubmissionDetails } from '@unbound-app/contracts/publish';
import type { SubmissionPreview } from '@unbound-app/contracts/review';
import { IconCircleInfo, IconPaperPlane2 } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { SubmitSection } from '~/components/submit/submit-section';
import TagSelect from '~/components/submit/tag-select';
import { Button } from '~/components/ui/button';

type SubmissionDetailsFormProps = {
	/** Its suggested tags are the form's starting values. */
	preview: SubmissionPreview;
	error: string | null;
	disabled: boolean;
	onSubmit: (details: SubmissionDetails) => void;
};

const DISCORD_INVITE = 'https://discord.gg/rMdzhWUaGT';

function TagsHint() {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger
					type='button'
					aria-label='About tags'
					className='rounded-full text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-halo'
				>
					<IconCircleInfo size={14} />
				</TooltipTrigger>
				<TooltipContent side='top' sideOffset={6}>
					Request a tag on{' '}
					<a
						href={DISCORD_INVITE}
						target='_blank'
						rel='noopener noreferrer'
						className='font-semibold underline underline-offset-2'
					>
						Discord
					</a>{' '}
					if none match your addon’s purpose.
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function SubmissionDetailsForm({ preview, error, disabled, onSubmit }: SubmissionDetailsFormProps) {
	const id = useId();
	const form = useForm({
		defaultValues: { tags: preview.suggestedTags },
		onSubmit: ({ value }) => onSubmit(value),
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
				description='How the addon is filed on the site.'
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
								<div className='flex items-center gap-2'>
									<FieldLabel htmlFor={`${id}-tags`}>Tags</FieldLabel>
									<TagsHint />
								</div>
								<TagSelect
									id={`${id}-tags`}
									type={preview.manifest.type ?? 'plugin'}
									value={field.state.value}
									onChange={field.handleChange}
									disabled={disabled}
								/>
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
