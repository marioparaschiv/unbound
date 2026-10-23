import type { ReactNode } from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import Input from '~/components/ui/input';
import Tag from '~/components/tag';

type FieldIssue = {
	message?: string;
};

type PinnableFieldProps = {
	id: string;
	label: string;
	/** Whether staff override the value; otherwise it follows the served version's manifest. */
	pinned: boolean;
	/** The manifest's value, as text. */
	manifestValue: string;
	/** Shows the manifest value in a textarea rather than an input. */
	multiline?: boolean;
	onOverride: () => void;
	onFollow: () => void;
	errors: (FieldIssue | undefined)[];
	/** The control that edits the overriding value. */
	children: ReactNode;
};

const READ_ONLY = 'bg-muted/50 dark:bg-muted/50 text-muted-foreground shadow-none resize-none';

function PinnableField({
	id,
	label,
	pinned,
	manifestValue,
	multiline = false,
	onOverride,
	onFollow,
	errors,
	children,
}: PinnableFieldProps) {
	const Control = multiline ? Textarea : Input;

	return (
		<Field data-invalid={errors.length > 0} className='gap-2'>
			<div className='flex items-center gap-2 min-h-6'>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				<Tag variant={pinned ? 'primary' : 'default'}>
					{pinned ? 'Overridden' : 'From manifest'}
				</Tag>
				<Button
					type='button'
					variant='link'
					size='sm'
					className='ml-auto px-0 h-6 text-xs'
					aria-label={pinned ? `Use manifest for ${label}` : `Override ${label}`}
					onClick={pinned ? onFollow : onOverride}
				>
					{pinned ? 'Use manifest' : 'Override'}
				</Button>
			</div>
			{pinned ? (
				children
			) : (
				<Control
					id={id}
					readOnly
					value={manifestValue}
					placeholder='Empty'
					className={READ_ONLY}
				/>
			)}
			{pinned ? (
				<FieldDescription className='truncate' title={manifestValue}>
					Manifest: {manifestValue || 'empty'}
				</FieldDescription>
			) : null}
			<FieldError errors={errors} />
		</Field>
	);
}

export default PinnableField;
