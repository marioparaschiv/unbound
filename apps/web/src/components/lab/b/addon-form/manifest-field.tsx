import type { ReactNode } from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import { Button } from '~/components/ui/button';

type FieldIssue = {
	message?: string;
};

type ManifestFieldProps = {
	id: string;
	label: string;
	/** Whether staff override the value; otherwise it follows the served version's manifest. */
	overridden: boolean;
	/** The manifest's value as text; `null` when no version is served. */
	manifestText: string | null;
	onReset: () => void;
	disabled: boolean;
	errors: (FieldIssue | undefined)[];
	/** The control, always showing the effective value; editing it overrides the field. */
	children: ReactNode;
};

/**
 * @description A listing field that shows its effective value and says where that value comes from.
 * @param props The field's label, override state, manifest value and control.
 * @returns The field.
 */
function ManifestField({
	id,
	label,
	overridden,
	manifestText,
	onReset,
	disabled,
	errors,
	children,
}: ManifestFieldProps) {
	return (
		<Field data-invalid={errors.length > 0} className='gap-2'>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{children}
			{overridden ? (
				<FieldDescription className='flex flex-wrap items-baseline gap-x-2'>
					<span className='min-w-0 truncate' title={manifestText ?? undefined}>
						Overridden.{' '}
						{manifestText === null
							? 'No version is served yet.'
							: `The manifest says “${manifestText || 'nothing'}”.`}
					</span>
					{disabled ? null : (
						<Button
							type='button'
							variant='link'
							size='sm'
							className='px-0 h-auto text-sm'
							onClick={onReset}
						>
							Reset to manifest
						</Button>
					)}
				</FieldDescription>
			) : (
				<FieldDescription>
					{manifestText === null
						? 'Follows the manifest once a version is served.'
						: disabled
							? 'From manifest.'
							: 'From manifest. Edit it to override.'}
				</FieldDescription>
			)}
			<FieldError errors={errors} />
		</Field>
	);
}

export default ManifestField;
