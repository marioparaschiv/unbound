import type { EditAddonRequest } from '@unbound-app/contracts/admin';

import { CHANGE_LABELS, changedKeys } from '~/components/lab/c/use-settings-form';
import type { SettingsForm } from '~/components/lab/c/use-settings-form';
import { Button } from '~/components/ui/button';
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
						// The header pill's shell: one ring, one inset, every control the same 32px height inside it.
						className='bottom-20 left-1/2 z-40 fixed flex flex-wrap sm:flex-nowrap items-center gap-1 bg-card/90 supports-[backdrop-filter]:bg-card/75 shadow-float backdrop-blur-md p-1.5 rounded-control ring-1 ring-border ring-inset w-[min(40rem,calc(100%-2rem))] -translate-x-1/2 animate-reveal'
						onSubmit={(event) => {
							event.preventDefault();
							void form.handleSubmit();
						}}
					>
						<Text
							as='span'
							variant='text-sm'
							className='inline-flex items-center gap-2 pr-1 pl-2.5 h-8 font-semibold whitespace-nowrap shrink-0'
							aria-live='polite'
							title={changed.map((key) => CHANGE_LABELS[key]).join(', ')}
						>
							<span className='bg-primary rounded-full size-1.5' aria-hidden />
							{changed.length === 1
								? `${changed.map((key) => CHANGE_LABELS[key]).join('')} changed`
								: `${changed.length} unsaved changes`}
						</Text>
						<span
							className='hidden sm:block bg-border mx-1 w-px h-5 shrink-0'
							aria-hidden
						/>
						<form.Field name='reason'>
							{(field) => (
								<input
									aria-label='Reason, recorded in the moderation log'
									placeholder='Add a reason for the log'
									className='order-last sm:order-none bg-transparent hover:bg-accent/50 focus:bg-accent px-2.5 rounded-inner outline-none focus-visible:ring-[3px] focus-visible:ring-halo w-full sm:w-auto sm:flex-1 min-w-0 h-8 text-sm placeholder:text-muted-foreground transition-colors'
									value={field.state.value ?? ''}
									onChange={(event) =>
										field.handleChange(event.target.value || undefined)
									}
									onBlur={field.handleBlur}
									aria-invalid={field.state.meta.errors.length > 0}
								/>
							)}
						</form.Field>
						<div className='flex gap-1 ml-auto shrink-0'>
							<Button
								type='button'
								variant='secondary'
								size='sm'
								onClick={() => form.reset()}
								disabled={isSubmitting}
							>
								Discard
							</Button>
							<Button type='submit' size='sm' disabled={!canSubmit || isSubmitting}>
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
