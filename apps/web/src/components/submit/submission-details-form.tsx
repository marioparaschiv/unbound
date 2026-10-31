import type { SubmissionDetails } from '@unbound-app/contracts/publish';
import type { SubmissionPreview } from '@unbound-app/contracts/review';
import type { UserSummary } from '@unbound-app/contracts/account';
import { IconCircleInfo, IconEye, IconPaperPlane2 } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { Field, FieldGroup, FieldLabel } from '~/components/ui/field';
import { SubmitCallout } from '~/components/submit/submit-callout';
import type { ApiErrorDetails } from '~/lib/api/error-details';
import MaintainerPicker from '~/components/submit/maintainer-picker';
import { SubmitSection } from '~/components/submit/submit-section';
import IconField from '~/components/submit/icon-field';
import TagSelect from '~/components/submit/tag-select';
import { Button } from '~/components/ui/button';

type SubmissionDetailsFormProps = {
	/** Its suggested tags and maintainers are the form's starting values. */
	preview: SubmissionPreview;
	error: ApiErrorDetails | null;
	disabled: boolean;
	onSubmit: (details: SubmissionDetails) => void;
};

const DISCORD_INVITE = 'https://discord.gg/rMdzhWUaGT';

type DetailsDraft = {
	tags: string[];
	maintainers: UserSummary[];
	/** Only a new listing picks one; `null` keeps the type's default. */
	icon: string | null;
};

function sameIds(a: string[], b: string[]): boolean {
	const set = new Set(a);

	return a.length === b.length && b.every((id) => set.has(id));
}

type FieldHintProps = {
	/** Names the hint for screen readers, such as "About tags". */
	label: string;
	children: ReactNode;
};

function FieldHint({ label, children }: FieldHintProps) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger
					type='button'
					aria-label={label}
					className='rounded-full text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-halo'
				>
					<IconCircleInfo size={14} />
				</TooltipTrigger>
				<TooltipContent side='top' sideOffset={6} className='max-w-64'>
					{children}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function SubmissionDetailsForm({ preview, error, disabled, onSubmit }: SubmissionDetailsFormProps) {
	const id = useId();
	const defaultValues: DetailsDraft = {
		tags: preview.suggestedTags,
		maintainers: preview.suggestedMaintainers,
		icon: null,
	};
	const form = useForm({
		defaultValues,
		onSubmit: ({ value }) => {
			const maintainers = value.maintainers.map((maintainer) => maintainer.id);
			const current = preview.suggestedMaintainers.map((maintainer) => maintainer.id);
			// An update's suggested tags are its current ones; a listing's come from topics and still need sending.
			const keepTags =
				preview.kind === 'update' && sameIds(value.tags, preview.suggestedTags);

			// Sending a set rewrites the addon's tags or maintainers on approval, so only send one the author changed.
			onSubmit({
				...(keepTags ? {} : { tags: value.tags }),
				...(sameIds(maintainers, current) ? {} : { maintainers }),
				...(value.icon ? { icon: value.icon } : {}),
			});
		},
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
					<div className='flex sm:flex-row flex-col gap-3 w-full'>
						<Button type='submit' disabled={disabled} className='w-full sm:w-auto'>
							<IconPaperPlane2 size={24} />
							{disabled ? 'Submitting...' : 'Submit for Review'}
						</Button>
						<form.Subscribe selector={(state) => state.values}>
							{(draft) => (
								<Button asChild variant='outline' className='w-full sm:w-auto'>
									<Link
										to='/submit/preview'
										search={{
											repository: preview.source.repository,
											path: preview.source.path,
											ref: preview.source.ref,
											commitSha: preview.source.commitSha,
											icon: draft.icon ?? undefined,
											tags:
												draft.tags.length > 0
													? draft.tags.join(',')
													: undefined,
										}}
										target='_blank'
										rel='noopener'
									>
										<IconEye size={24} />
										Preview Page
									</Link>
								</Button>
							)}
						</form.Subscribe>
					</div>
				}
			>
				<FieldGroup className='gap-6'>
					{preview.kind === 'listing' ? (
						<form.Field name='icon'>
							{(field) => (
								<Field>
									<FieldLabel htmlFor={`${id}-icon`}>Icon</FieldLabel>
									<IconField
										id={`${id}-icon`}
										type={preview.manifest.type ?? 'plugin'}
										value={field.state.value}
										onChange={field.handleChange}
										disabled={disabled}
									/>
								</Field>
							)}
						</form.Field>
					) : null}
					<form.Field name='tags'>
						{(field) => (
							<Field>
								<div className='flex items-center gap-2'>
									<FieldLabel htmlFor={`${id}-tags`}>Tags</FieldLabel>
									<FieldHint label='About tags'>
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
									</FieldHint>
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
					<form.Field name='maintainers'>
						{(field) => (
							<Field>
								<div className='flex items-center gap-2'>
									<FieldLabel htmlFor={`${id}-maintainers`}>
										Maintainers
									</FieldLabel>
									<FieldHint label='About maintainers'>
										Adding someone as a maintainer lets them trigger updates to
										this addon from your repository.
									</FieldHint>
								</div>
								<MaintainerPicker
									id={`${id}-maintainers`}
									value={field.state.value}
									onChange={field.handleChange}
									editable={preview.canEditMaintainers}
									disabled={disabled}
								/>
							</Field>
						)}
					</form.Field>
					<SubmitCallout error={error} />
				</FieldGroup>
			</SubmitSection>
		</form>
	);
}

export default SubmissionDetailsForm;
