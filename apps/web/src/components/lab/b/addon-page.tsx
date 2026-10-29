import { getRouteApi, Link, notFound, useRouteContext } from '@tanstack/react-router';
import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import { IconArrowLeft, IconArrowUpRight } from 'nucleo-micro-bold';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import SubmissionHistory from '~/components/admin/submission-history';
import { adminAddonQuery } from '~/queries/admin-addons/admin-addons';
import MaintainerEditor from '~/components/admin/maintainer-editor';
import type { LabVariantId } from '~/components/lab/lab-variant';
import { staggerStyle } from '~/components/motion/reveal-style';
import { formatDate } from '~/components/admin/format-date';
import VersionTable from '~/components/admin/version-table';
import StatusPill from '~/components/dashboard/status-pill';
import BlurReveal from '~/components/motion/blur-reveal';
import StaffNotes from '~/components/admin/staff-notes';
import type { AdminAddonView } from '~/lib/admin-addon';
import EventLog from '~/components/admin/event-log';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

import type { DocSection } from './settings-doc';

import SettingsDoc, { Fact, SettingsSection } from './settings-doc';
import useSettingsForm from './addon-form/use-settings-form';
import ListingFields from './addon-form/listing-fields';
import { TYPE_LABELS } from './addon-form/changes';
import DangerZone from './addon-form/danger-zone';
import SaveBar from './addon-form/save-bar';

type Permissions = {
	canEdit: boolean;
	canDelist: boolean;
	canTransfer: boolean;
	canServe: boolean;
	canWriteNotes: boolean;
};

type AddonDocumentProps = {
	view: AdminAddonView;
	variant: LabVariantId;
	can: Permissions;
};

const route = getRouteApi('/_site/_staff/lab/$variant/addons/$id');

function AddonDocument({ view, variant, can }: AddonDocumentProps) {
	const { addon, maintainers, versions, submissions, events, notes, manifest } = view;
	const form = useSettingsForm(view);
	const [users, setUsers] = useState<Record<string, UserSummary>>(() =>
		Object.fromEntries(maintainers.map(({ id, name, image }) => [id, { id, name, image }])),
	);
	const sections: DocSection[] = [
		{ id: 'overview', title: 'Overview' },
		{ id: 'listing', title: 'Listing' },
		{ id: 'source', title: 'Source' },
		{ id: 'maintainers', title: 'Maintainers' },
		{ id: 'versions', title: 'Versions' },
		{ id: 'submissions', title: 'Submissions' },
		{ id: 'notes', title: 'Notes' },
		{ id: 'log', title: 'Log' },
		...(can.canDelist || can.canTransfer ? [{ id: 'danger', title: 'Danger zone' }] : []),
	];

	return (
		<SettingsDoc sections={sections}>
			<SettingsSection
				id='overview'
				title='Overview'
				action={
					<Button asChild variant='outline' size='sm'>
						<Link to='/addons/$id' params={{ id: addon.id }}>
							View in store
							<IconArrowUpRight size={24} />
						</Link>
					</Button>
				}
			>
				<dl className='flex flex-col divide-y divide-border'>
					<Fact label='Type'>{TYPE_LABELS[addon.type]}</Fact>
					<Fact label='Served version'>
						<span className='font-mono'>{addon.latestVersion ?? 'None'}</span>
					</Fact>
					<Fact label='First approved'>{formatDate(addon.createdAt)}</Fact>
					<Fact label='Last updated'>{formatDate(addon.updatedAt)}</Fact>
					{addon.delistedAt ? (
						<Fact label='Delisted'>{formatDate(addon.delistedAt)}</Fact>
					) : null}
				</dl>
			</SettingsSection>

			<SettingsSection
				id='listing'
				title='Listing'
				description='What the store shows. Each field follows the served version’s manifest until you edit it; an override stays through later approvals.'
			>
				<ListingFields form={form} manifest={manifest} disabled={!can.canEdit} />
			</SettingsSection>

			<SettingsSection id='source' title='Source' description='Where the addon’s code lives.'>
				<form.Field name='repository'>
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0} className='gap-2'>
							<FieldLabel htmlFor='b-edit-repository'>Repository</FieldLabel>
							<Input
								id='b-edit-repository'
								placeholder='owner/name'
								value={field.state.value ?? ''}
								onChange={(event) =>
									field.handleChange(event.target.value.trim() || null)
								}
								onBlur={field.handleBlur}
								disabled={!can.canEdit}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
							<FieldDescription>
								The GitHub repository the addon is built from, as owner/name.
							</FieldDescription>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>
			</SettingsSection>

			<SettingsSection
				id='maintainers'
				title='Maintainers'
				description='Maintainers can submit updates. Owners can also add and remove maintainers. Every addon needs at least one owner.'
			>
				{can.canTransfer ? (
					<form.Field name='maintainers'>
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor='b-edit-maintainers' className='sr-only'>
									Add a maintainer
								</FieldLabel>
								<MaintainerEditor
									id='b-edit-maintainers'
									members={field.state.value}
									users={users}
									onChange={(members: MaintainerEntry[]) =>
										field.handleChange(members)
									}
									onPick={(user) =>
										setUsers((current) => ({ ...current, [user.id]: user }))
									}
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>
				) : (
					<ul className='flex flex-col divide-y divide-border'>
						{maintainers.map((maintainer) => (
							<li key={maintainer.id}>
								<Link
									to='/lab/$variant/users/$id'
									params={{ variant, id: maintainer.id }}
									className='flex items-center gap-3 py-2.5 hover:underline'
								>
									<UserAvatar
										src={maintainer.image}
										name={maintainer.name}
										size='xs'
									/>
									<Text
										as='span'
										variant='text-sm'
										className='flex-1 font-medium'
									>
										{maintainer.name}
									</Text>
									<Tag
										variant={
											maintainer.role === 'owner' ? 'primary' : 'default'
										}
									>
										{maintainer.role}
									</Tag>
								</Link>
							</li>
						))}
					</ul>
				)}
			</SettingsSection>

			<SettingsSection
				id='versions'
				title='Versions'
				description={
					can.canServe
						? 'Every approved version, newest first. Serve an older one to roll back.'
						: 'Every approved version, newest first.'
				}
			>
				<VersionTable addonId={addon.id} versions={versions} canServe={can.canServe} />
			</SettingsSection>

			<SettingsSection
				id='submissions'
				title='Submissions'
				description='Everything submitted under this id, with each review decision.'
			>
				<SubmissionHistory submissions={submissions} label='author' />
			</SettingsSection>

			<SettingsSection
				id='notes'
				title='Notes'
				description='Private to staff. Authors never see these.'
			>
				<StaffNotes
					subject={{ type: 'addon', id: addon.id }}
					notes={notes}
					canWrite={can.canWriteNotes}
				/>
			</SettingsSection>

			<SettingsSection
				id='log'
				title='Log'
				description='Every moderation action on this addon, newest first.'
			>
				<EventLog subject={{ type: 'addon', id: addon.id }} timeline={events} />
			</SettingsSection>

			{can.canDelist || can.canTransfer ? (
				<SettingsSection id='danger' title='Danger zone' danger>
					<DangerZone
						form={form}
						addon={addon}
						initiallyDelisted={view.form.delisted}
						canDelist={can.canDelist}
						canTransfer={can.canTransfer}
					/>
				</SettingsSection>
			) : null}

			<SaveBar form={form} initial={view.form} manifest={manifest} users={users} />
		</SettingsDoc>
	);
}

function AddonPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const { variant, id } = route.useParams();
	const { data: view } = useSuspenseQuery(adminAddonQuery(id));

	if (!view) {
		throw notFound();
	}

	const { addon } = view;
	const can: Permissions = {
		canEdit: hasPermission(viewer.role, { addon: ['edit'] }),
		canDelist: hasPermission(viewer.role, { addon: ['delist'] }),
		canTransfer: hasPermission(viewer.role, { addon: ['transfer'] }),
		canServe: hasPermission(viewer.role, { addon: ['rollback'] }),
		canWriteNotes: hasPermission(viewer.role, { note: ['write'] }),
	};

	return (
		<div className='flex flex-col gap-8'>
			<div className='flex flex-col gap-3'>
				<Link
					to='/lab/$variant/addons'
					params={{ variant }}
					className='inline-flex items-center gap-1 w-fit text-muted-foreground hover:text-foreground text-sm'
				>
					<IconArrowLeft className='size-4' />
					All addons
				</Link>
				<div className='flex flex-wrap items-center gap-3 min-w-0'>
					<Text variant='heading-lg' className='min-w-0 truncate'>
						<BlurReveal text={addon.name} />
					</Text>
					<div className='animate-reveal' style={staggerStyle(1)}>
						<StatusPill status={addon.delistedAt ? 'delisted' : 'listed'} />
					</div>
				</div>
				<Text
					variant='text-sm'
					color='muted'
					className='font-mono animate-reveal'
					style={staggerStyle(1)}
				>
					{addon.id}
				</Text>
			</div>

			<div className='animate-reveal' style={staggerStyle(2)}>
				<AddonDocument key={view.form.revision} view={view} variant={variant} can={can} />
			</div>
		</div>
	);
}

export default AddonPage;
