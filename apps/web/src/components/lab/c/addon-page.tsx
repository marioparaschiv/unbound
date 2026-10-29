import { getRouteApi, Link, notFound, useRouteContext } from '@tanstack/react-router';
import { IconArrowLeft, IconArrowUpRight } from 'nucleo-micro-bold';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';

import ListingField, { toAddonType, TYPE_LABELS } from '~/components/lab/c/listing-field';
import type { SettingsForm } from '~/components/lab/c/use-settings-form';
import { adminAddonQuery } from '~/queries/admin-addons/admin-addons';
import AddonIconControl from '~/components/admin/addon-icon-control';
import useSettingsForm from '~/components/lab/c/use-settings-form';
import type { ActivityFilter } from '~/components/lab/c/activity';
import type { LabVariantId } from '~/components/lab/lab-variant';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import { TransferButton } from '~/components/lab/c/addon-moves';
import { staggerStyle } from '~/components/motion/reveal-style';
import { formatDate } from '~/components/admin/format-date';
import StatusPill from '~/components/dashboard/status-pill';
import { Card, CardContent } from '~/components/ui/card';
import { addonQuery } from '~/queries/marketplace/addon';
import StaffFacts from '~/components/lab/c/staff-facts';
import type { AdminAddonView } from '~/lib/admin-addon';
import AuthorByline from '~/components/author-byline';
import { TONES } from '~/components/dashboard/status';
import SavePill from '~/components/lab/c/save-pill';
import Activity from '~/components/lab/c/activity';
import { hasPermission } from '~/lib/auth/access';
import AddonIcon from '~/components/addon-icon';
import { Button } from '~/components/ui/button';
import Markdown from '~/components/markdown';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

const route = getRouteApi('/_site/_staff/lab/$variant/addons/$id');

type Permissions = {
	canEdit: boolean;
	canDelist: boolean;
	canTransfer: boolean;
	canServe: boolean;
	canWriteNotes: boolean;
};

type StorefrontProps = {
	view: AdminAddonView;
	store: MarketplaceAddonDetails | null | undefined;
	variant: LabVariantId;
	permissions: Permissions;
	form?: SettingsForm;
	/** Stagger the page in; off when a save remounts it, so saving does not replay the entrance. */
	reveal: boolean;
};

type ListingSlotProps = {
	view: AdminAddonView;
	form?: SettingsForm;
	className?: string;
};

type StorePageProps = {
	store: MarketplaceAddonDetails;
};

function NameSlot({ view, form, className }: ListingSlotProps) {
	function render(name: string): ReactNode {
		return (
			<Text as='h1' variant='heading-lg' className='break-words'>
				{name || 'Untitled'}
			</Text>
		);
	}

	if (!form) {
		return <div className={className}>{render(view.addon.name)}</div>;
	}

	return (
		<form.Field name='name'>
			{(field) => (
				<ListingField
					label='Name'
					control='input'
					editable
					className={className}
					value={field.state.value}
					manifestValue={view.manifest?.name ?? view.addon.name}
					errors={field.state.meta.errors}
					onChange={(next) => field.handleChange(next)}
				>
					{render}
				</ListingField>
			)}
		</form.Field>
	);
}

function DescriptionSlot({ view, form, className }: ListingSlotProps) {
	function render(description: string): ReactNode {
		return (
			<Text variant='text-md' color='muted' className='max-w-3xl whitespace-pre-wrap'>
				{description || 'No description.'}
			</Text>
		);
	}

	if (!form) {
		return <div className={className}>{render(view.addon.description)}</div>;
	}

	return (
		<form.Field name='description'>
			{(field) => (
				<ListingField
					label='Description'
					control='textarea'
					editable
					className={className}
					value={field.state.value}
					manifestValue={view.manifest?.description ?? view.addon.description}
					errors={field.state.meta.errors}
					onChange={(next) => field.handleChange(next)}
				>
					{render}
				</ListingField>
			)}
		</form.Field>
	);
}

function TypeSlot({ view, form }: ListingSlotProps) {
	function render(label: string): ReactNode {
		return <span>{label}</span>;
	}

	if (!form) {
		return render(TYPE_LABELS[view.addon.type]);
	}

	return (
		<form.Field name='type'>
			{(field) => (
				<ListingField
					label='Type'
					control='type'
					editable
					value={field.state.value}
					manifestValue={view.manifest?.type ?? view.addon.type}
					errors={field.state.meta.errors}
					onChange={(next) =>
						field.handleChange(next === null ? null : (toAddonType(next) ?? null))
					}
				>
					{render}
				</ListingField>
			)}
		</form.Field>
	);
}

function StorePage({ store }: StorePageProps) {
	const [expanded, setExpanded] = useState(false);
	const { source } = store;

	if (!source?.addonMd) return null;

	return (
		<Card className='relative gap-0 overflow-hidden'>
			<CardContent className={cn(!expanded && 'max-h-96 overflow-hidden')}>
				<Markdown source={source.addonMd} pin={source.pin} />
			</CardContent>
			{expanded ? null : (
				<div className='right-0 bottom-0 left-0 absolute flex justify-center bg-linear-to-t from-card via-card/90 to-transparent pt-16 pb-4'>
					<Button variant='secondary' size='sm' onClick={() => setExpanded(true)}>
						Show the whole store page
					</Button>
				</div>
			)}
		</Card>
	);
}

function Storefront({
	view,
	store,
	variant,
	permissions,
	form,
	reveal: revealProp,
}: StorefrontProps) {
	// Frozen per mount, so a later re-render (the store page loading, typing) never cuts an entrance short.
	const [reveal] = useState(revealProp);
	const [filter, setFilter] = useState<ActivityFilter>('all');
	const { addon, submissions } = view;
	const inReview = submissions.some((submission) => submission.status === 'pending_review');
	const tags = store?.source?.details.tags ?? [];
	const changelogs = Object.fromEntries(
		(store?.versions ?? []).map((version) => [version.version, version]),
	);

	const revealClass = reveal ? 'animate-reveal' : null;

	function at(index: number) {
		return reveal ? staggerStyle(index) : undefined;
	}

	function showVersions() {
		setFilter('version');
		document.getElementById('activity')?.scrollIntoView({ behavior: 'smooth' });
	}

	return (
		<div className='flex flex-col gap-8'>
			<div className='flex flex-wrap justify-between items-center gap-3 text-sm'>
				<Link
					to='/lab/$variant/addons'
					params={{ variant }}
					className='inline-flex items-center gap-1 text-muted-foreground hover:text-foreground'
				>
					<IconArrowLeft className='size-4' />
					Addons
				</Link>
				<span className='font-mono text-muted-foreground'>{addon.id}</span>
			</div>

			{addon.delistedAt ? (
				<div
					className={cn(
						'px-4 py-3 border rounded-control text-sm',
						TONES.neutral.callout,
					)}
				>
					<span className='font-semibold'>Delisted.</span> Users cannot find this page or
					get updates. Below is how it would look if relisted.
				</div>
			) : null}

			<header className='flex flex-col gap-4'>
				<div className='flex sm:flex-row flex-col sm:items-center gap-4'>
					<div className={cn('shrink-0', revealClass)} style={at(0)}>
						{form ? (
							// The store's icon tile is itself the control, like the other fields edited in place.
							<form.Field name='icon'>
								{(field) => (
									<AddonIconControl
										compact
										id='c-icon'
										type={addon.type}
										value={field.state.value}
										saved={addon.icon}
										savedSvg={addon.iconSvg}
										onChange={(icon) => field.handleChange(icon)}
									/>
								)}
							</form.Field>
						) : (
							<div className='flex justify-center items-center bg-accent border rounded-surface size-16'>
								<AddonIcon
									type={addon.type}
									svg={addon.iconSvg}
									className='size-8'
								/>
							</div>
						)}
					</div>
					<div
						className={cn('flex flex-col flex-1 gap-1 min-w-0', revealClass)}
						style={at(1)}
					>
						<NameSlot view={view} form={form} className='self-start max-w-full' />
						<Text
							as='div'
							variant='text-sm'
							color='muted'
							className='flex flex-wrap items-center gap-1.5'
						>
							{store ? (
								<AuthorByline authors={store.authors} linkProfiles />
							) : (
								<span>by {addon.owners.map((owner) => owner.name).join(', ')}</span>
							)}
							<span>· v{addon.latestVersion ?? 'none'} ·</span>
							<TypeSlot view={view} form={form} />
							{/* Hidden on a phone, where it would wrap onto a line of its own. */}
							<span className='hidden sm:inline'>
								· Updated {formatDate(addon.updatedAt)}
							</span>
							{inReview ? <StatusPill status='pending_review' /> : null}
						</Text>
					</div>
					<div
						className={cn('flex flex-wrap gap-2 self-start sm:self-auto', revealClass)}
						style={at(2)}
					>
						{store ? (
							<Button asChild variant='outline' size='sm'>
								<Link to='/addons/$id' params={{ id: addon.id }} target='_blank'>
									Store page
									<IconArrowUpRight />
								</Link>
							</Button>
						) : null}
						{permissions.canTransfer ? <TransferButton addon={addon} /> : null}
					</div>
				</div>
				<div className={cn('flex flex-col gap-4', revealClass)} style={at(2)}>
					<DescriptionSlot view={view} form={form} className='self-start max-w-3xl' />
					{tags.length > 0 ? (
						<ul className='flex flex-wrap gap-1.5' aria-label='Tags'>
							{tags.map((tag) => (
								<li key={tag}>
									<Tag className='px-2 py-1 text-xs'>{tag}</Tag>
								</li>
							))}
						</ul>
					) : null}
				</div>
			</header>

			<StaffFacts
				view={view}
				variant={variant}
				form={form}
				canDelist={permissions.canDelist}
				onShowVersions={showVersions}
				revealFrom={reveal ? 3 : null}
			/>

			{store?.source?.addonMd ? (
				<section className={cn('flex flex-col gap-4', revealClass)} style={at(7)}>
					<Text as='h2' variant='heading-sm'>
						Store page
					</Text>
					<StorePage store={store} />
				</section>
			) : null}

			<Activity
				revealFrom={reveal ? 7 : null}
				subject={{ type: 'addon', id: addon.id }}
				timeline={view.events}
				submissions={submissions}
				submissionLabel='author'
				notes={view.notes}
				canWriteNotes={permissions.canWriteNotes}
				versions={{
					addonId: addon.id,
					versions: view.versions,
					canServe: permissions.canServe,
					changelogs,
				}}
				filter={filter}
				onFilterChange={setFilter}
			/>

			{form ? <SavePill form={form} initial={view.form} /> : null}
		</div>
	);
}

function EditableStorefront(props: Omit<StorefrontProps, 'form'>) {
	const form = useSettingsForm(props.view);

	return <Storefront {...props} form={form} />;
}

function AddonPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const { variant, id } = route.useParams();
	const { data: view } = useSuspenseQuery(adminAddonQuery(id));
	const { data: store } = useQuery(addonQuery(id));
	// Only the page's first revision enters; a save bumps it and remounts the storefront without replaying it.
	const [firstRevision] = useState(view?.form.revision);

	if (!view) {
		throw notFound();
	}

	const permissions: Permissions = {
		canEdit: hasPermission(viewer.role, { addon: ['edit'] }),
		canDelist: hasPermission(viewer.role, { addon: ['delist'] }),
		canTransfer: hasPermission(viewer.role, { addon: ['transfer'] }),
		canServe: hasPermission(viewer.role, { addon: ['rollback'] }),
		canWriteNotes: hasPermission(viewer.role, { note: ['write'] }),
	};

	if (!permissions.canEdit) {
		return (
			<Storefront
				view={view}
				store={store}
				variant={variant}
				permissions={permissions}
				reveal
			/>
		);
	}

	// A save changes the revision, so the form restarts from the saved values.
	return (
		<EditableStorefront
			key={view.form.revision}
			view={view}
			store={store}
			variant={variant}
			permissions={permissions}
			reveal={view.form.revision === firstRevision}
		/>
	);
}

export default AddonPage;
