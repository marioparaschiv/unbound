import type { EditAddonRequest } from '@unbound-app/contracts/admin';
import { IconArrowRight, IconChevronDown } from 'nucleo-micro-bold';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useState } from 'react';

import type { ManifestSummary } from '~/lib/admin-addon';
import { FieldError } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

import type { SettingsForm } from './use-settings-form';

import { describeChanges } from './changes';

type SaveBarProps = {
	form: SettingsForm;
	initial: EditAddonRequest;
	manifest: ManifestSummary | null;
	users: Record<string, UserSummary>;
};

// Appears only once something changed, and names what changed so the reason has context.
function SaveBar({ form, initial, manifest, users }: SaveBarProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<form.Subscribe
			selector={(state) => [state.values, state.canSubmit, state.isSubmitting] as const}
		>
			{([values, canSubmit, isSubmitting]) => {
				const changes = describeChanges(initial, values, { manifest, users });

				if (changes.length === 0) return null;

				return (
					<Card
						className='bottom-20 z-10 sticky gap-3 bg-card/95 shadow-float backdrop-blur-md mt-8 px-4 py-3 animate-reveal'
						role='region'
						aria-label='Unsaved changes'
					>
						{expanded ? (
							<dl className='flex flex-col gap-2 pb-3 border-b'>
								{changes.map((change) => (
									<div
										key={change.key}
										className='items-baseline gap-x-3 grid grid-cols-[6.5rem_minmax(0,1fr)] text-sm'
									>
										<dt className='font-semibold'>{change.label}</dt>
										<dd className='flex flex-wrap items-baseline gap-x-2 min-w-0'>
											<span className='text-muted-foreground line-through break-words'>
												{change.before}
											</span>
											<IconArrowRight className='self-center size-3 text-muted-foreground shrink-0' />
											<span className='break-words'>{change.after}</span>
										</dd>
									</div>
								))}
							</dl>
						) : null}
						<form
							className='flex flex-wrap md:flex-nowrap items-center gap-3'
							onSubmit={(event) => {
								event.preventDefault();
								void form.handleSubmit();
							}}
						>
							<button
								type='button'
								className='inline-flex items-center gap-1.5 rounded-item outline-none focus-visible:ring-[3px] focus-visible:ring-halo min-w-0 font-semibold text-sm text-left press-flat'
								aria-expanded={expanded}
								onClick={() => setExpanded((open) => !open)}
							>
								<span className='truncate'>
									{changes.map((change) => change.label).join(', ')} changed
								</span>
								<IconChevronDown
									className={cn(
										'size-3 text-muted-foreground transition-transform shrink-0',
										expanded ? 'rotate-180' : null,
									)}
								/>
							</button>
							<form.Field name='reason'>
								{(field) => (
									<div className='flex flex-col order-last md:order-none gap-1 w-full md:flex-1'>
										<Input
											id='b-edit-reason'
											aria-label='Reason for the moderation log'
											placeholder='Reason for the log (optional)'
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
									onClick={() => {
										setExpanded(false);
										form.reset();
									}}
									disabled={isSubmitting}
								>
									Discard
								</Button>
								<Button type='submit' disabled={!canSubmit || isSubmitting}>
									Save changes
								</Button>
							</div>
						</form>
						{canSubmit ? null : (
							<Text variant='text-xs' color='destructive'>
								Fix the highlighted fields above to save.
							</Text>
						)}
					</Card>
				);
			}}
		</form.Subscribe>
	);
}

export default SaveBar;
