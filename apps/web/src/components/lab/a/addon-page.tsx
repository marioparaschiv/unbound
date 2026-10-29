import { getRouteApi, Link, notFound, useRouteContext } from '@tanstack/react-router';
import { IconArrowLeft, IconArrowUpRight } from 'nucleo-micro-bold';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { useState } from 'react';

import { adminAddonQuery } from '~/queries/admin-addons/admin-addons';
import type { LabVariantId } from '~/components/lab/lab-variant';
import { staggerStyle } from '~/components/motion/reveal-style';
import { formatDate } from '~/components/admin/format-date';
import VersionTable from '~/components/admin/version-table';
import BlurReveal from '~/components/motion/blur-reveal';
import type { AdminAddonView } from '~/lib/admin-addon';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

import type { Tab } from './tab-strip';

import useSettingsForm from './settings/use-settings-form';
import MaintainersCard from './settings/maintainers-card';
import ListingCard from './settings/listing-card';
import { changedKeys } from './settings/changes';
import AddonActions from './addon-actions';
import SaveBar from './settings/save-bar';
import StatusDot from './status-dot';
import TabStrip from './tab-strip';
import Activity from './activity';

type AddonTab = 'listing' | 'versions' | 'maintainers' | 'activity';

type Permissions = {
	canEdit: boolean;
	canServe: boolean;
	canWriteNotes: boolean;
};

type AddonTabsProps = Permissions & {
	view: AdminAddonView;
	variant: LabVariantId;
	tab: AddonTab;
	onTab: (tab: AddonTab) => void;
};

type ReadOnlyMaintainersProps = {
	view: AdminAddonView;
	variant: LabVariantId;
};

const route = getRouteApi('/_site/_staff/lab/$variant/addons/$id');

function ReadOnlyMaintainers({ view, variant }: ReadOnlyMaintainersProps) {
	return (
		<Card className='gap-0 py-0 divide-y divide-border'>
			{view.maintainers.map((maintainer) => (
				<Link
					key={maintainer.id}
					to='/lab/$variant/users/$id'
					params={{ variant, id: maintainer.id }}
					className='flex items-center gap-3 hover:bg-muted/30 px-(--card-pad) py-3'
				>
					<UserAvatar src={maintainer.image} name={maintainer.name} size='sm' />
					<span className='flex-1 font-medium text-sm truncate'>{maintainer.name}</span>
					<Tag variant={maintainer.role === 'owner' ? 'primary' : 'default'}>
						{maintainer.role}
					</Tag>
				</Link>
			))}
		</Card>
	);
}

function AddonTabs({
	view,
	variant,
	tab,
	onTab,
	canEdit,
	canServe,
	canWriteNotes,
}: AddonTabsProps) {
	const form = useSettingsForm(view);
	const values = useStore(form.store, (state) => state.values);
	const changed = changedKeys(values, view.form);
	const { addon } = view;
	const tabs: Tab<AddonTab>[] = [
		{
			value: 'listing',
			label: 'Listing',
			marked: changed.some((key) => key !== 'maintainers'),
		},
		{ value: 'versions', label: `Versions · ${view.versions.length}` },
		{
			value: 'maintainers',
			label: `Maintainers · ${view.maintainers.length}`,
			marked: changed.includes('maintainers'),
		},
		{ value: 'activity', label: 'Activity' },
	];

	return (
		<form
			className='flex flex-col gap-5 animate-reveal'
			style={staggerStyle(2)}
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<TabStrip tabs={tabs} value={tab} onChange={onTab} />

			{tab === 'listing' && canEdit ? (
				<ListingCard form={form} manifest={view.manifest} changed={changed} />
			) : null}
			{tab === 'listing' && !canEdit ? (
				<Card className='gap-2 p-(--card-pad)'>
					<Text variant='heading-sm'>{addon.name}</Text>
					<Text variant='text-sm' color='muted'>
						{addon.description}
					</Text>
					<Text variant='text-sm' color='muted'>
						Repository: {addon.repository ?? 'None'}
					</Text>
				</Card>
			) : null}

			{tab === 'versions' ? (
				<div className='flex flex-col gap-2'>
					<VersionTable addonId={addon.id} versions={view.versions} canServe={canServe} />
					{canServe ? (
						<Text variant='text-xs' color='muted'>
							To roll back, serve an older version from its row. Newer versions are
							withdrawn until you serve them again.
						</Text>
					) : null}
				</div>
			) : null}

			{tab === 'maintainers' && canEdit ? (
				<MaintainersCard form={form} maintainers={view.maintainers} />
			) : null}
			{tab === 'maintainers' && !canEdit ? (
				<ReadOnlyMaintainers view={view} variant={variant} />
			) : null}

			{tab === 'activity' ? (
				<Activity
					subject={{ type: 'addon', id: addon.id }}
					notes={view.notes}
					canWriteNotes={canWriteNotes}
					submissions={view.submissions}
					submissionLabel='author'
					events={view.events}
				/>
			) : null}

			{canEdit ? <SaveBar form={form} changed={changed} /> : null}
		</form>
	);
}

function AddonPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const { variant, id } = route.useParams();
	const { data: view } = useSuspenseQuery(adminAddonQuery(id));
	const [tab, setTab] = useState<AddonTab>('listing');

	if (!view) {
		throw notFound();
	}

	const { addon } = view;
	const canEdit = hasPermission(viewer.role, { addon: ['edit'] });
	const canDelist = hasPermission(viewer.role, { addon: ['delist'] });
	const canTransfer = hasPermission(viewer.role, { addon: ['transfer'] });
	const canServe = hasPermission(viewer.role, { addon: ['rollback'] });
	const canWriteNotes = hasPermission(viewer.role, { note: ['write'] });

	return (
		<div className='flex flex-col gap-6 pb-40'>
			<Link
				to='/lab/$variant/addons'
				params={{ variant }}
				className='inline-flex items-center gap-1 w-fit text-muted-foreground hover:text-foreground text-sm'
			>
				<IconArrowLeft className='size-4' />
				All addons
			</Link>

			<header className='flex flex-wrap justify-between items-start gap-4'>
				<div className='flex flex-col gap-1.5 min-w-0'>
					<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
						<Text variant='heading-lg' className='truncate'>
							<BlurReveal text={addon.name} />
						</Text>
						<span className='animate-reveal' style={staggerStyle(1)}>
							{addon.delistedAt ? (
								<StatusDot
									tone='neutral'
									label={`Delisted ${formatDate(addon.delistedAt)}`}
								/>
							) : (
								<StatusDot tone='success' label='Listed' />
							)}
						</span>
					</div>
					<Text
						variant='text-sm'
						color='muted'
						className='flex flex-wrap gap-x-2 animate-reveal'
						style={staggerStyle(1)}
					>
						<span className='font-mono'>{addon.id}</span>
						<span>·</span>
						<span className='capitalize'>{addon.type}</span>
						<span>·</span>
						<span>
							Serving{' '}
							<span className='font-mono text-foreground'>
								{addon.latestVersion ?? 'nothing'}
							</span>
						</span>
						<span>·</span>
						<span>Updated {formatDate(addon.updatedAt)}</span>
					</Text>
				</div>
				<div
					className='flex flex-wrap items-center gap-2 animate-reveal'
					style={staggerStyle(1)}
				>
					{addon.delistedAt ? null : (
						<Button variant='outline' asChild>
							<Link to='/addons/$id' params={{ id: addon.id }}>
								<IconArrowUpRight size={24} />
								View in Store
							</Link>
						</Button>
					)}
					<AddonActions addon={addon} canDelist={canDelist} canTransfer={canTransfer} />
				</div>
			</header>

			<AddonTabs
				key={view.form.revision}
				view={view}
				variant={variant}
				tab={tab}
				onTab={setTab}
				canEdit={canEdit}
				canServe={canServe}
				canWriteNotes={canWriteNotes}
			/>
		</div>
	);
}

export default AddonPage;
