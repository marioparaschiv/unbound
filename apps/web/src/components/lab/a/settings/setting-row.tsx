import type { ReactNode } from 'react';

import { FieldError } from '~/components/ui/field';
import Label from '~/components/ui/label';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type FieldIssue = {
	message?: string;
};

type SettingRowProps = {
	id: string;
	label: string;
	/** One plain sentence on what the setting does. */
	description?: ReactNode;
	/** A control on the label's line, such as the "Use manifest value" switch. */
	aside?: ReactNode;
	changed?: boolean;
	errors?: (FieldIssue | undefined)[];
	children: ReactNode;
};

function SettingRow({
	id,
	label,
	description,
	aside,
	changed = false,
	errors = [],
	children,
}: SettingRowProps) {
	return (
		<div
			role='group'
			aria-labelledby={`${id}-label`}
			className='gap-x-8 gap-y-3 grid md:grid-cols-[12rem_1fr] px-(--card-pad) py-5'
		>
			<div className='flex flex-col gap-1'>
				<div className='flex items-center gap-2'>
					<Label id={`${id}-label`} htmlFor={id}>
						{label}
					</Label>
					<span
						aria-hidden={!changed}
						title='Unsaved change'
						className={cn(
							'bg-primary rounded-full size-1.5 transition-opacity',
							changed ? 'opacity-100' : 'opacity-0',
						)}
					/>
				</div>
				{description ? (
					<Text variant='text-xs' color='muted'>
						{description}
					</Text>
				) : null}
			</div>
			<div className='flex flex-col gap-2 min-w-0'>
				{aside}
				{children}
				<FieldError errors={errors} />
			</div>
		</div>
	);
}

export default SettingRow;
