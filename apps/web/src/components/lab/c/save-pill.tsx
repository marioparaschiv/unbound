import type { EditAddonRequest } from '@unbound-app/contracts/admin';

import { CHANGE_LABELS, changedKeys } from '~/components/lab/c/use-settings-form';
import type { SettingsForm } from '~/components/lab/c/use-settings-form';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type SavePillProps = {
	form: SettingsForm;
	initial: EditAddonRequest;
};

/** Floats over the page while the addon has unsaved edits: what changed, a reason, Discard and Save. */
function SavePill({ form, initial }: SavePillProps) {
	return (
		<form.Subscribe
			selector={(state) =>
				[changedKeys(initial, state.values), state.canSubmit, state.isSubmitting] as const
			}
		>
			{([changed, canSubmit, isSubmitting]) =>
				changed.length === 0 ? null : (
					<form
						aria-label='Unsaved changes'
						className='bottom-20 left-1/2 z-40 fixed flex flex-wrap sm:flex-nowrap items-center gap-2 bg-card/90 supports-[backdrop-filter]:bg-card/75 shadow-float backdrop-blur-md p-2 sm:pl-4 border rounded-surface w-[min(44rem,calc(100%-2rem))] -translate-x-1/2 animate-reveal'
						onSubmit={(event) => {
							event.preventDefault();
							void form.handleSubmit();
						}}
					>
						<Text
							as='span'
							variant='text-sm'
							className='px-2 sm:px-0 font-semibold shrink-0'
							aria-live='polite'
							title={changed.map((key) => CHANGE_LABELS[key]).join(', ')}
						>
							{changed.length === 1
								? `${changed.map((key) => CHANGE_LABELS[key]).join('')} changed`
								: `${changed.length} unsaved changes`}
						</Text>
						<form.Field name='reason'>
							{(field) => (
								<Input
									aria-label='Reason, recorded in the moderation log'
									placeholder='Reason (optional, kept in the log)'
									className='order-last sm:order-none w-full sm:flex-1 sm:w-auto min-w-0'
									value={field.state.value ?? ''}
									onChange={(event) =>
										field.handleChange(event.target.value || undefined)
									}
									onBlur={field.handleBlur}
									aria-invalid={field.state.meta.errors.length > 0}
								/>
							)}
						</form.Field>
						<div className='flex gap-2 ml-auto shrink-0'>
							<Button
								type='button'
								variant='ghost'
								onClick={() => form.reset()}
								disabled={isSubmitting}
							>
								Discard
							</Button>
							<Button type='submit' disabled={!canSubmit || isSubmitting}>
								{isSubmitting ? 'Saving…' : 'Save'}
							</Button>
						</div>
					</form>
				)
			}
		</form.Subscribe>
	);
}

export default SavePill;
