import type { DisplayStatus } from '~/components/dashboard/status';
import { getStatusStyle } from '~/components/dashboard/status';
import cn from '~/lib/cn';

type StatusPillProps = {
	status: DisplayStatus;
};

function StatusPill({ status }: StatusPillProps) {
	const style = getStatusStyle(status);

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium text-[11px] whitespace-nowrap',
				style.pill,
			)}
		>
			<span className={cn('rounded-full size-1.5 shrink-0', style.dot)} />
			{style.label}
		</span>
	);
}

export default StatusPill;
