import { IconAlertTriangle } from '@tabler/icons-react';

import SubmitDialog from '~/components/dashboard/submit-dialog';
import { getStatusStyle } from '~/components/dashboard/status';
import type { DashboardAddon } from '~/lib/dashboard';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type AttentionListProps = {
	addons: DashboardAddon[];
	githubLinked: boolean;
};

const STYLE = getStatusStyle('changes_requested');

function AttentionList({ addons, githubLinked }: AttentionListProps) {
	const flagged = addons.flatMap(({ id, name, pending, actions }) =>
		pending && actions.submit === 'republish' ? [{ id, name, pending }] : [],
	);

	if (flagged.length === 0) return null;

	return (
		<section aria-label='Needs your attention' className='flex flex-col gap-3'>
			{flagged.map(({ id, name, pending }) => (
				<div
					key={id}
					className={cn(
						'flex flex-wrap items-start gap-3 p-4 border rounded-xl',
						STYLE.callout,
					)}
				>
					<span
						className={cn(
							'grid place-items-center rounded-full size-8 shrink-0',
							STYLE.pill,
						)}
					>
						<IconAlertTriangle size={16} />
					</span>
					<div className='flex flex-col flex-1 gap-1 min-w-48'>
						<Text variant='text-sm' className='font-medium'>
							{name} <span className='font-mono'>{pending.version}</span> needs
							changes
						</Text>
						{pending.note ? (
							<Text
								variant='text-sm'
								color='muted'
								className='break-words whitespace-pre-wrap'
							>
								{pending.note}
							</Text>
						) : null}
					</div>
					<SubmitDialog
						addonId={id}
						intent='republish'
						githubLinked={githubLinked}
						variant='outline'
					/>
				</div>
			))}
		</section>
	);
}

export default AttentionList;
