import type { Tone } from '~/components/dashboard/status';
import { TONES } from '~/components/dashboard/status';
import cn from '~/lib/cn';

type StatusDotProps = {
	tone: Tone;
	label: string;
	title?: string;
};

function StatusDot({ tone, label, title }: StatusDotProps) {
	return (
		<span
			title={title}
			className='inline-flex items-center gap-2 font-medium text-sm whitespace-nowrap'
		>
			<span className={cn('rounded-full size-2 shrink-0', TONES[tone].dot)} />
			{label}
		</span>
	);
}

export default StatusDot;
