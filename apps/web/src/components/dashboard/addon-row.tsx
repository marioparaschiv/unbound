import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import AddonIconPopout from '~/components/dashboard/addon-icon-popout';
import SubmitDialog from '~/components/dashboard/submit-dialog';
import StatusPill from '~/components/dashboard/status-pill';
import AddonMenu from '~/components/dashboard/addon-menu';
import RoleTag from '~/components/dashboard/role-tag';
import type { DashboardAddon } from '~/lib/dashboard';
import AddonIcon from '~/components/addon-icon';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type AddonRowProps = {
	addon: DashboardAddon;
	userId: string;
	githubLinked: boolean;
};

// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

function describeLive(addon: DashboardAddon): string {
	if (addon.kind === 'listing' || !addon.live) {
		return 'Not published yet';
	}

	return `v${addon.live.version} · ${DATE_FORMAT.format(new Date(addon.live.publishedAt))}`;
}

function AddonRow({ addon, userId, githubLinked }: AddonRowProps) {
	const [iconOpen, setIconOpen] = useState(false);

	return (
		<li className='flex flex-wrap items-center gap-x-4 gap-y-3 p-(--card-pad)'>
			{addon.actions.icon && addon.kind === 'published' ? (
				<AddonIconPopout
					addonId={addon.id}
					name={addon.name}
					type={addon.type}
					icon={addon.icon}
					iconSvg={addon.iconSvg}
					open={iconOpen}
					onOpenChange={setIconOpen}
				/>
			) : (
				<div className='flex justify-center items-center bg-accent rounded-control size-10 shrink-0'>
					<AddonIcon type={addon.type} svg={addon.iconSvg} className='size-5' />
				</div>
			)}

			<div className='flex flex-col flex-1 gap-1.5 min-w-40'>
				<div className='flex flex-wrap items-center gap-2'>
					<Text as='span' variant='text-md' className='font-semibold'>
						{addon.actions.publicPage ? (
							<Link
								to='/addons/$id'
								params={{ id: addon.id }}
								className='hover:underline'
							>
								{addon.name}
							</Link>
						) : (
							addon.name
						)}
					</Text>
					{addon.kind === 'published' ? (
						<RoleTag role={addon.role} />
					) : (
						<Tag>New listing</Tag>
					)}
				</div>
				<Text variant='text-xs' color='muted' className='truncate'>
					<span className='font-mono'>{addon.id}</span> · {describeLive(addon)}
				</Text>
				<div className='flex flex-wrap items-center gap-1.5'>
					{addon.kind === 'published' ? <StatusPill status={addon.visibility} /> : null}
					{addon.pending ? (
						<span className='inline-flex items-center gap-1.5'>
							<StatusPill status={addon.pending.status} />
							<Text as='span' variant='text-xs' color='muted' className='font-mono'>
								{addon.pending.version}
							</Text>
						</span>
					) : null}
				</div>
			</div>

			<div className='flex items-center gap-2 ml-auto'>
				{addon.actions.submit ? (
					<SubmitDialog
						addonId={addon.id}
						intent={addon.actions.submit}
						githubLinked={githubLinked}
						source={addon.pending?.source}
					/>
				) : null}
				<AddonMenu addon={addon} userId={userId} onChangeIcon={() => setIconOpen(true)} />
			</div>
		</li>
	);
}

export default AddonRow;
