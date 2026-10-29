import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Button, buttonVariants } from '~/components/ui/button';
import { FieldError } from '~/components/ui/field';
import Input from '~/components/ui/input';
import Label from '~/components/ui/label';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

import type { SettingsForm } from './use-settings-form';
import type { EditableKey } from './changes';

import { EDITABLE_LABELS } from './changes';

type SaveBarProps = {
	form: SettingsForm;
	changed: EditableKey[];
};

function describe(changed: EditableKey[]): string {
	const labels = changed.map((key) => EDITABLE_LABELS[key]);

	if (labels.length <= 2) {
		return labels.join(' and ');
	}

	return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

function SaveBar({ form, changed }: SaveBarProps) {
	const [open, setOpen] = useState(false);
	const dirty = changed.length > 0;

	// A save changes the addon's revision, which remounts the form and closes this popover; a failure keeps it open.
	function save() {
		void form.handleSubmit();
	}

	return (
		<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
			{([canSubmit, isSubmitting]) => (
				<div
					aria-hidden={!dirty}
					inert={!dirty}
					className={cn(
						'bottom-20 left-1/2 z-40 fixed flex items-center gap-3 bg-card/90 supports-[backdrop-filter]:bg-card/75 shadow-float backdrop-blur-md py-2.5 pr-2.5 pl-5 border rounded-surface w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 transition-[translate,opacity] duration-300 ease-out',
						dirty ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
					)}
				>
					<div className='flex flex-col flex-1 min-w-0' aria-live='polite'>
						<Text as='span' variant='text-sm' className='font-semibold'>
							{changed.length} unsaved {changed.length === 1 ? 'change' : 'changes'}
						</Text>
						<Text as='span' variant='text-xs' color='muted' className='truncate'>
							{describe(changed)}
						</Text>
					</div>
					<Button
						type='button'
						variant='outline'
						onClick={() => form.reset()}
						disabled={isSubmitting}
					>
						Discard
					</Button>
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger
							type='button'
							disabled={!canSubmit || isSubmitting}
							className={buttonVariants()}
						>
							Save
						</PopoverTrigger>
						<PopoverContent side='top' align='end' className='flex flex-col gap-3 w-80'>
							<form.Field name='reason'>
								{(field) => (
									<div className='flex flex-col gap-1.5'>
										<Label htmlFor='lab-a-reason'>Reason (optional)</Label>
										<Input
											id='lab-a-reason'
											autoFocus
											placeholder='e.g. Fixed a typo in the name'
											value={field.state.value ?? ''}
											onChange={(event) =>
												field.handleChange(event.target.value || undefined)
											}
											onKeyDown={(event) => {
												if (event.key !== 'Enter') return;

												event.preventDefault();
												save();
											}}
											aria-invalid={field.state.meta.errors.length > 0}
										/>
										<Text variant='text-xs' color='muted'>
											Recorded in the moderation log with your edit.
										</Text>
										<FieldError errors={field.state.meta.errors} />
									</div>
								)}
							</form.Field>
							<Button
								type='button'
								onClick={save}
								disabled={!canSubmit || isSubmitting}
							>
								{isSubmitting
									? 'Saving…'
									: `Save ${changed.length === 1 ? 'change' : 'changes'}`}
							</Button>
						</PopoverContent>
					</Popover>
				</div>
			)}
		</form.Subscribe>
	);
}

export default SaveBar;
