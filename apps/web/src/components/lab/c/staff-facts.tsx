import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '~/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import type { SettingsForm } from '~/components/lab/c/use-settings-form';
import MaintainerEditor from '~/components/admin/maintainer-editor';
import type { LabVariantId } from '~/components/lab/lab-variant';
import { staggerStyle } from '~/components/motion/reveal-style';
import { Button, buttonVariants } from '~/components/ui/button';
import { ListingToggle } from '~/components/lab/c/addon-moves';
import StatusPill from '~/components/dashboard/status-pill';
import type { AdminAddonView } from '~/lib/admin-addon';
import AvatarPile from '~/components/ui/avatar-pile';
import UserAvatar from '~/components/user-avatar';
import { Card } from '~/components/ui/card';
import Switch from '~/components/ui/switch';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type StaffFactsProps = {
	view: AdminAddonView;
	variant: LabVariantId;
	/** `undefined` when the viewer may not edit the addon. */
	form?: SettingsForm;
	canDelist: boolean;
	onShowVersions: () => void;
	/** The stagger position of the first cell, or `null` to skip the entrance. */
	revealFrom: number | null;
};

type FactCellProps = {
	label: string;
	unsaved?: boolean;
	action?: ReactNode;
	children: ReactNode;
};

type FormRowProps = {
	form: SettingsForm;
	view: AdminAddonView;
};

type MaintainerPileProps = {
	members: MaintainerEntry[];
	users: Record<string, UserSummary>;
};

// Every cell's action reads as a quiet text link under its value, so the strip scans as facts first.
const ACTION_CLASS = 'self-start -ml-2 px-2 h-7 text-muted-foreground hover:text-foreground';

function FactCell({ label, unsaved = false, action, children }: FactCellProps) {
	return (
		<div className='flex flex-col gap-1 bg-card p-(--card-pad) min-w-0'>
			<Text as='span' variant='text-xs' color='muted' className='flex items-center gap-1.5'>
				{label}
				{unsaved ? <span className='font-semibold text-primary'>· Unsaved</span> : null}
			</Text>
			<Text as='div' variant='text-sm' className='flex-1 min-w-0'>
				{children}
			</Text>
			{action}
		</div>
	);
}

function MaintainerPile({ members, users }: MaintainerPileProps) {
	const owners = members.filter((member) => member.role === 'owner');

	return (
		<span className='flex items-center gap-2 min-w-0'>
			<AvatarPile size={22} totalCount={members.length} aria-hidden>
				{members.slice(0, 3).map((member) => (
					<UserAvatar
						key={member.userId}
						className='size-full text-[10px]'
						src={users[member.userId]?.image ?? null}
						name={users[member.userId]?.name ?? member.userId}
					/>
				))}
			</AvatarPile>
			<span className='truncate'>
				{owners.map((owner) => users[owner.userId]?.name ?? owner.userId).join(', ')}
				{members.length > owners.length
					? ` + ${members.length - owners.length} more`
					: null}
			</span>
		</span>
	);
}

function VisibilityRow({ form, view }: FormRowProps) {
	return (
		<form.Field name='delisted'>
			{(field) => (
				<FactCell
					label='Visibility'
					unsaved={field.state.value !== view.form.delisted}
					action={
						<Popover>
							<PopoverTrigger
								type='button'
								className={cn(
									buttonVariants({ variant: 'ghost', size: 'sm' }),
									ACTION_CLASS,
								)}
							>
								Change
							</PopoverTrigger>
							<PopoverContent align='start' className='w-80'>
								<Field orientation='horizontal' className='justify-between gap-4'>
									<FieldContent>
										<FieldLabel htmlFor='c-listed'>
											Listed on the store
										</FieldLabel>
										<FieldDescription>
											Off hides it from listings, the catalog and update
											checks. Installs keep working.
										</FieldDescription>
									</FieldContent>
									<Switch
										id='c-listed'
										checked={!field.state.value}
										onCheckedChange={(listed) => field.handleChange(!listed)}
									/>
								</Field>
							</PopoverContent>
						</Popover>
					}
				>
					<StatusPill status={field.state.value ? 'delisted' : 'listed'} />
				</FactCell>
			)}
		</form.Field>
	);
}

function SourceRow({ form, view }: FormRowProps) {
	return (
		<form.Field name='repository'>
			{(field) => (
				<FactCell
					label='Source repository'
					unsaved={field.state.value !== view.form.repository}
					action={
						<Popover>
							<PopoverTrigger
								type='button'
								className={cn(
									buttonVariants({ variant: 'ghost', size: 'sm' }),
									ACTION_CLASS,
								)}
							>
								Change
							</PopoverTrigger>
							<PopoverContent align='start' className='w-80'>
								<Field data-invalid={field.state.meta.errors.length > 0}>
									<FieldLabel htmlFor='c-repository'>
										GitHub repository
									</FieldLabel>
									<Input
										id='c-repository'
										placeholder='owner/name'
										value={field.state.value ?? ''}
										onChange={(event) =>
											field.handleChange(event.target.value.trim() || null)
										}
										onBlur={field.handleBlur}
										aria-invalid={field.state.meta.errors.length > 0}
									/>
									<FieldDescription>
										Submissions must prove push access to it. Leave empty to
										unpin.
									</FieldDescription>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							</PopoverContent>
						</Popover>
					}
				>
					{field.state.value ? (
						<a
							href={`https://github.com/${field.state.value}`}
							target='_blank'
							rel='noreferrer'
							className='font-mono text-xs hover:underline break-all'
						>
							{field.state.value}
						</a>
					) : (
						<span className='text-muted-foreground'>Not pinned</span>
					)}
				</FactCell>
			)}
		</form.Field>
	);
}

function MaintainersRow({ form, view }: FormRowProps) {
	const [users, setUsers] = useState(() =>
		Object.fromEntries(
			view.maintainers.map(({ id, name, image }) => [id, { id, name, image }]),
		),
	);

	return (
		<form.Field name='maintainers'>
			{(field) => (
				<FactCell
					label='Maintainers'
					unsaved={
						JSON.stringify(field.state.value) !== JSON.stringify(view.form.maintainers)
					}
					action={
						<Dialog>
							<DialogTrigger asChild>
								<Button variant='ghost' size='sm' className={ACTION_CLASS}>
									Manage
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Maintainers</DialogTitle>
									<DialogDescription>
										Maintainers can submit updates. Owners can also add and
										remove maintainers. Keep at least one owner. Changes save
										with the rest of the page.
									</DialogDescription>
								</DialogHeader>
								<MaintainerEditor
									id='c-maintainers'
									members={field.state.value}
									users={users}
									onChange={(members) => field.handleChange(members)}
									onPick={(user) =>
										setUsers((current) => ({ ...current, [user.id]: user }))
									}
								/>
								<FieldError errors={field.state.meta.errors} />
								<DialogFooter>
									<DialogTrigger asChild>
										<Button>Done</Button>
									</DialogTrigger>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					}
				>
					<MaintainerPile members={field.state.value} users={users} />
				</FactCell>
			)}
		</form.Field>
	);
}

/**
 * @description The staff-only facts under the store header, one cell each with the control that changes it.
 * @param props The addon view, the settings form when editable, and the stagger start.
 * @returns The facts strip.
 */
function StaffFacts({
	view,
	variant,
	form,
	canDelist,
	onShowVersions,
	revealFrom,
}: StaffFactsProps) {
	const { addon, maintainers } = view;

	const cells = [
		form ? (
			<VisibilityRow key='visibility' form={form} view={view} />
		) : (
			<FactCell
				key='visibility'
				label='Visibility'
				action={canDelist ? <ListingToggle addon={addon} /> : null}
			>
				<StatusPill status={addon.delistedAt ? 'delisted' : 'listed'} />
			</FactCell>
		),
		<FactCell
			key='version'
			label='Served version'
			action={
				<Button variant='ghost' size='sm' className={ACTION_CLASS} onClick={onShowVersions}>
					Version history
				</Button>
			}
		>
			<span className='font-mono'>{addon.latestVersion ?? 'None'}</span>
		</FactCell>,
		form ? <SourceRow key='source' form={form} view={view} /> : null,
		form ? (
			<MaintainersRow key='maintainers' form={form} view={view} />
		) : (
			<FactCell key='maintainers' label='Maintainers'>
				<span className='flex flex-col gap-1'>
					{maintainers.map((maintainer) => (
						<Link
							key={maintainer.id}
							to='/lab/$variant/users/$id'
							params={{ variant, id: maintainer.id }}
							className='hover:underline'
						>
							{maintainer.name}{' '}
							<span className='text-muted-foreground'>({maintainer.role})</span>
						</Link>
					))}
				</span>
			</FactCell>
		),
	].filter(Boolean);

	// Hairline gaps over the border colour draw the dividers, whatever the column count.
	return (
		<Card className='gap-px grid grid-cols-2 lg:grid-cols-4 bg-border p-0 overflow-hidden'>
			{cells.map((cell, index) => (
				<div
					key={index}
					className={cn('grid bg-card', revealFrom !== null && 'animate-reveal')}
					style={revealFrom === null ? undefined : staggerStyle(revealFrom + index)}
				>
					{cell}
				</div>
			))}
		</Card>
	);
}

export default StaffFacts;
