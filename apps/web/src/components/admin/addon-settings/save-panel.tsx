import type { AddonSettingsForm } from '~/components/admin/addon-settings/use-addon-settings-form';
import { FieldError } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type SavePanelProps = {
	form: AddonSettingsForm;
};

function SavePanel({ form }: SavePanelProps) {
	return (
		<form.Subscribe
			selector={(state) =>
				[!state.isDefaultValue, state.canSubmit, state.isSubmitting] as const
			}
		>
			{([changed, canSubmit, isSubmitting]) => (
				<Card
					className={cn(
						'flex-row flex-wrap md:flex-nowrap items-center gap-3 px-4 py-3',
						changed
							? 'bottom-4 z-10 sticky bg-card/90 supports-[backdrop-filter]:bg-card/75 shadow-float backdrop-blur-md'
							: null,
					)}
				>
					<Text
						as='span'
						variant='text-sm'
						color={changed ? 'normal' : 'muted'}
						className='shrink-0'
						aria-live='polite'
					>
						{changed ? 'Unsaved changes' : 'No unsaved changes'}
					</Text>
					<form.Field name='reason'>
						{(field) => (
							<div className='flex flex-col order-last md:order-none gap-1 w-full md:flex-1'>
								<Input
									id='edit-reason'
									aria-label='Reason'
									placeholder='Reason, recorded in the moderation log'
									value={field.state.value ?? ''}
									onChange={(event) =>
										field.handleChange(event.target.value || undefined)
									}
									onBlur={field.handleBlur}
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
					<div className='flex gap-2 ml-auto shrink-0'>
						<Button
							type='button'
							variant='outline'
							onClick={() => form.reset()}
							disabled={!changed || isSubmitting}
						>
							Discard
						</Button>
						<Button type='submit' disabled={!changed || !canSubmit || isSubmitting}>
							Save
						</Button>
					</div>
				</Card>
			)}
		</form.Subscribe>
	);
}

export default SavePanel;
