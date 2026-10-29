import type { EditAddonRequest } from '@unbound-app/contracts/admin';
import { useState } from 'react';

import { CHANGE_LABELS, changedKeys } from '~/components/lab/c/use-settings-form';
import type { ChangeKey, SettingsForm } from '~/components/lab/c/use-settings-form';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type SavePillProps = {
	form: SettingsForm;
	initial: EditAddonRequest;
};

type SaveBarProps = {
	form: SettingsForm;
	changed: ChangeKey[];
	canSubmit: boolean;
	isSubmitting: boolean;
};

/**
 * @description Words the unsaved fields for the bar's label.
 * @param changed The changed fields.
 * @returns e.g. "Icon changed" or "3 unsaved changes".
 */
function describe(changed: ChangeKey[]): string {
	const [only] = changed;

	return changed.length === 1 && only
		? `${CHANGE_LABELS[only]} changed`
		: `${changed.length} unsaved changes`;
}

function SaveBar({ form, changed, canSubmit, isSubmitting }: SaveBarProps) {
	const open = changed.length > 0;
	// Keeps the last label while the bar slides away, so it never reads "0 unsaved changes" on the way out.
	const [label, setLabel] = useState(() => describe(changed));

	if (open && label !== describe(changed)) {
		setLabel(describe(changed));
	}

	return (
		<form
			aria-label='Unsaved changes'
			inert={!open}
			// Concentric corners: the 16px controls sit 6px in, so the shell's radius is 16 + 6.
			className={cn(
				'bottom-20 left-1/2 z-40 fixed flex flex-wrap sm:flex-nowrap items-center gap-1 bg-card/90 supports-[backdrop-filter]:bg-card/75 shadow-float backdrop-blur-md p-1.5 rounded-[calc(var(--radius-control)+6px)] ring-1 ring-border ring-inset w-[min(40rem,calc(100%-2rem))] -translate-x-1/2',
				'transition-[translate,opacity] motion-reduce:transition-none',
				open
					? 'translate-y-0 opacity-100 duration-300 ease-spring'
					: 'translate-y-[calc(100%+5rem)] opacity-0 duration-200 ease-out pointer-events-none',
			)}
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
				{label}
			</Text>
			<span className='hidden sm:block bg-border mx-1 w-px h-5 shrink-0' aria-hidden />
			<form.Field name='reason'>
				{(field) => (
					<input
						aria-label='Reason, recorded in the moderation log'
						placeholder='Add a reason for the log'
						// Ghost: no fill, border or ring in any state; the caret and the placeholder carry it.
						className='order-last sm:order-none bg-transparent px-3 outline-none w-full sm:w-auto sm:flex-1 min-w-0 h-8 text-sm placeholder:text-muted-foreground'
						value={field.state.value ?? ''}
						onChange={(event) => field.handleChange(event.target.value || undefined)}
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
	);
}

/** Slides up over the page while the addon has unsaved edits: what changed, a reason, Discard and Save. */
function SavePill({ form, initial }: SavePillProps) {
	return (
		<form.Subscribe
			selector={(state) =>
				[changedKeys(initial, state.values), state.canSubmit, state.isSubmitting] as const
			}
		>
			{([changed, canSubmit, isSubmitting]) => (
				<SaveBar
					form={form}
					changed={changed}
					canSubmit={canSubmit}
					isSubmitting={isSubmitting}
				/>
			)}
		</form.Subscribe>
	);
}

export default SavePill;
