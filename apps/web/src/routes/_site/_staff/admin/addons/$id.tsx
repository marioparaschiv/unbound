import { createFileRoute, Link, notFound, redirect } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { IconArrowLeft } from 'nucleo-micro-bold';

import AddonSettingsForm from '~/components/admin/addon-settings/addon-settings-form';
import SubmissionHistory from '~/components/admin/submission-history';
import { adminAddonQuery } from '~/queries/admin-addons/admin-addons';
import DetailSection from '~/components/admin/detail-section';
import AddonActions from '~/components/admin/addon-actions';
import { formatDate } from '~/components/admin/format-date';
import VersionTable from '~/components/admin/version-table';
import StatusPill from '~/components/dashboard/status-pill';
import DetailFact from '~/components/admin/detail-fact';
import StaffNotes from '~/components/admin/staff-notes';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import EventLog from '~/components/admin/event-log';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

function AdminAddonPage() {
	const { user: viewer } = Route.useRouteContext();
	const { id } = Route.useParams();
	const { data: view } = useSuspenseQuery(adminAddonQuery(id));

	// A refetch after the addon was deleted finds nothing.
	if (!view) {
		throw notFound();
	}

	const { addon, maintainers, versions, submissions, events, notes } = view;
	const canEdit = hasPermission(viewer.role, { addon: ['edit'] });
	const canDelist = hasPermission(viewer.role, { addon: ['delist'] });
	const canTransfer = hasPermission(viewer.role, { addon: ['transfer'] });
	const canServe = hasPermission(viewer.role, { addon: ['rollback'] });
	const canWriteNotes = hasPermission(viewer.role, { note: ['write'] });

	return (
		<div className='flex flex-col gap-8'>
			<div className='flex flex-col gap-4'>
				<Link
					to='/admin/addons'
					className='inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm'
				>
					<IconArrowLeft className='size-4' />
					Addons
				</Link>
				<div className='flex flex-wrap justify-between items-start gap-4'>
					<div className='flex flex-col gap-1 min-w-0'>
						<div className='flex items-center gap-3'>
							<Text variant='heading-lg' className='truncate'>
								{addon.name}
							</Text>
							<StatusPill status={addon.delistedAt ? 'delisted' : 'listed'} />
						</div>
						<Text variant='text-sm' color='muted' className='font-mono'>
							{addon.id}
						</Text>
						<Text variant='text-md' color='muted'>
							{addon.description}
						</Text>
					</div>
					<AddonActions addon={addon} canDelist={canDelist} canTransfer={canTransfer} />
				</div>
				<Card className='gap-4 grid grid-cols-2 md:grid-cols-4 p-(--card-pad)'>
					<DetailFact label='Type'>
						<span className='capitalize'>{addon.type}</span>
					</DetailFact>
					<DetailFact label='Served version'>
						<span className='font-mono'>{addon.latestVersion ?? 'None'}</span>
					</DetailFact>
					<DetailFact label='First approved'>{formatDate(addon.createdAt)}</DetailFact>
					<DetailFact label='Last updated'>{formatDate(addon.updatedAt)}</DetailFact>
					{addon.delistedAt ? (
						<DetailFact label='Delisted'>{formatDate(addon.delistedAt)}</DetailFact>
					) : null}
				</Card>
			</div>

			{canEdit ? (
				<DetailSection title='Settings'>
					<AddonSettingsForm key={view.form.revision} view={view} />
				</DetailSection>
			) : (
				<DetailSection title='Maintainers'>
					<Card className='flex-row flex-wrap gap-3 p-(--card-pad)'>
						{maintainers.map((maintainer) => (
							<Link
								key={maintainer.id}
								to='/admin/users/$id'
								params={{ id: maintainer.id }}
								className='flex items-center gap-2 hover:bg-accent/50 px-2 py-1 rounded-item press-flat'
							>
								<UserAvatar
									src={maintainer.image}
									name={maintainer.name}
									size='xs'
								/>
								<Text as='span' variant='text-sm' className='font-medium'>
									{maintainer.name}
								</Text>
								<Tag variant={maintainer.role === 'owner' ? 'primary' : 'default'}>
									{maintainer.role}
								</Tag>
							</Link>
						))}
					</Card>
				</DetailSection>
			)}

			<DetailSection title='Versions'>
				<VersionTable addonId={addon.id} versions={versions} canServe={canServe} />
			</DetailSection>

			<DetailSection title='Submissions'>
				<SubmissionHistory submissions={submissions} label='author' />
			</DetailSection>

			<DetailSection title='Staff notes'>
				<StaffNotes
					subject={{ type: 'addon', id: addon.id }}
					notes={notes}
					canWrite={canWriteNotes}
				/>
			</DetailSection>

			<DetailSection title='Moderation log'>
				<EventLog subject={{ type: 'addon', id: addon.id }} timeline={events} />
			</DetailSection>
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff/admin/addons/$id')({
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.addons.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	// `loader` comes before `head` so `head` can infer the loader data's type.
	loader: async ({ context, params }) => {
		const view = await context.queryClient.ensureQueryData(adminAddonQuery(params.id));

		if (!view) {
			throw notFound();
		}

		return view;
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `Unbound | ${loaderData?.addon.name ?? 'Addon'}` }],
	}),
	component: AdminAddonPage,
});
