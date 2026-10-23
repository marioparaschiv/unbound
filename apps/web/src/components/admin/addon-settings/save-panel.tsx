import type { AddonSettingsForm } from '~/components/admin/addon-settings/use-addon-settings-form';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { Card, CardContent, CardFooter } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import Text from '~/components/ui/text';

type SavePanelProps = {
	form: AddonSettingsForm;
};

function SavePanel({ form }: SavePanelProps) {
	return (
		<Card className='bottom-4 z-10 sticky gap-4 bg-card/90 supports-[backdrop-filter]:bg-card/75 shadow-lg backdrop-blur-md py-4'>
			<CardContent>
				<form.Field name='reason'>
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0} className='gap-2'>
							<FieldLabel htmlFor='edit-reason'>Reason</FieldLabel>
							<Textarea
								id='edit-reason'
								placeholder='Recorded in the moderation log with every change.'
								className='min-h-12'
								value={field.state.value ?? ''}
								onChange={(event) =>
									field.handleChange(event.target.value || undefined)
								}
								onBlur={field.handleBlur}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>
			</CardContent>
			<form.Subscribe
				selector={(state) =>
					[!state.isDefaultValue, state.canSubmit, state.isSubmitting] as const
				}
			>
				{([changed, canSubmit, isSubmitting]) => (
					<CardFooter className='justify-between gap-3 [.border-t]:pt-4 border-t'>
						<Text
							as='span'
							variant='text-sm'
							color={changed ? 'normal' : 'muted'}
							aria-live='polite'
						>
							{changed ? 'Unsaved changes' : 'No unsaved changes'}
						</Text>
						<div className='flex gap-2'>
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
					</CardFooter>
				)}
			</form.Subscribe>
		</Card>
	);
}

export default SavePanel;
