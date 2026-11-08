import { IconClone } from 'nucleo-micro-bold';

import copyText from '~/components/dashboard/copy-text';
import { Button } from '~/components/ui/button';

type CopyFieldProps = {
	/** What the value is, for the copy button's label and toasts. */
	label: string;
	value: string;
};

/**
 * @description A URL or command in a monospace field, with a button that copies it.
 * @param props The value and what it is.
 * @returns The field.
 */
function CopyField({ label, value }: CopyFieldProps) {
	return (
		<div className='flex items-center gap-2 bg-background pr-1 pl-3 border rounded-control min-w-0 h-11'>
			<code className='font-mono text-foreground text-sm truncate grow'>{value}</code>
			<Button
				variant='ghost'
				size='icon-sm'
				aria-label={`Copy the ${label}`}
				onClick={() => void copyText(value, label)}
			>
				<IconClone aria-hidden />
			</Button>
		</div>
	);
}

export default CopyField;
