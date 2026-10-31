import { IconBan, IconBox, IconChevronRight, IconUserCheck } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { formatDate, formatDateTime } from '~/components/admin/format-date';
import type { AdminUserRecord, MaintainedAddon } from '~/lib/admin-users';
import { staggerStyle } from '~/components/motion/reveal-style';
import StatusPill from '~/components/dashboard/status-pill';
import BlurReveal from '~/components/motion/blur-reveal';
import DetailFact from '~/components/admin/detail-fact';
import { TONES } from '~/components/dashboard/status';
import UserAvatar from '~/components/user-avatar';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type UserHeaderProps = {
	user: AdminUserRecord;
	addonCount: number;
	/** Staff controls on the right of the header, like the store page's Install button. */
	actions?: ReactNode;
};

type UserProps = {
	user: AdminUserRecord;
};

type AddonMetaProps = {
	addon: MaintainedAddon;
};

type AddonListProps = {
	addons: MaintainedAddon[];
};

/**
 * @description The user's identity, shaped like the public profile header.
 * @param props The user, how many addons they maintain and optional staff controls.
 * @returns The header.
 */
export function UserHeader({ user, addonCount, actions }: UserHeaderProps) {
	return (
		<header className='flex sm:flex-row flex-col sm:items-center gap-4'>
			<UserAvatar
				size='xl'
				className='rounded-surface object-cover animate-reveal'
				style={staggerStyle(0)}
				src={user.image}
				name={user.name}
			/>
			<div className='flex flex-col flex-1 gap-1 min-w-0'>
				<div className='flex items-center gap-2 min-w-0'>
					<Text as='h1' variant='heading-lg' className='truncate'>
						<BlurReveal text={user.name} />
					</Text>
					<Tag
						variant={user.role === 'user' ? 'default' : 'primary'}
						className='capitalize animate-reveal'
						style={staggerStyle(1)}
					>
						{user.role}
					</Tag>
				</div>
				<Text
					variant='text-sm'
					color='muted'
					className='animate-reveal'
					style={staggerStyle(1)}
				>
					Member since {formatDate(user.createdAt)} · maintains {addonCount}{' '}
					{addonCount === 1 ? 'addon' : 'addons'}
				</Text>
			</div>
			{actions ? (
				<div className='self-start sm:self-auto animate-reveal' style={staggerStyle(2)}>
					{actions}
				</div>
			) : null}
		</header>
	);
}

/**
 * @description Banned or active, with the ban's end and reason when there is one.
 * @param props The user.
 * @returns The standing pill.
 */
export function Standing({ user }: UserProps) {
	return (
		<span className='flex flex-col items-start gap-1'>
			<span
				className={cn(
					'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium text-[11px]',
					user.banned ? TONES.danger.pill : TONES.success.pill,
				)}
			>
				{user.banned ? (
					<IconBan className='size-3' />
				) : (
					<IconUserCheck className='size-3' />
				)}
				{user.banned
					? `Banned${user.banExpires ? ` until ${formatDateTime(user.banExpires)}` : ''}`
					: 'Active'}
			</span>
			{user.banned && user.banReason ? (
				<span className='text-muted-foreground text-xs'>“{user.banReason}”</span>
			) : null}
		</span>
	);
}

/**
 * @description Email, standing, join date and id in one strip.
 * @param props The user.
 * @returns The facts card.
 */
export function UserFacts({ user }: UserProps) {
	return (
		<Card className='gap-4 grid grid-cols-2 md:grid-cols-4 p-(--card-pad)'>
			<div className='col-span-2 md:col-span-1 min-w-0'>
				<DetailFact label='Email'>
					<span className='wrap-anywhere'>{user.email}</span>
				</DetailFact>
			</div>
			<DetailFact label='Standing'>
				<Standing user={user} />
			</DetailFact>
			<DetailFact label='Joined'>{formatDate(user.createdAt)}</DetailFact>
			<div className='col-span-2 md:col-span-1 min-w-0'>
				<DetailFact label='User id'>
					<span className='font-mono text-xs wrap-anywhere'>{user.id}</span>
				</DetailFact>
			</div>
		</Card>
	);
}

function AddonMeta({ addon }: AddonMetaProps) {
	return (
		<>
			<span className='font-mono text-muted-foreground text-xs sm:text-sm'>
				{addon.latestVersion ?? 'None'}
			</span>
			<Tag variant={addon.role === 'owner' ? 'primary' : 'default'} className='capitalize'>
				{addon.role}
			</Tag>
			<StatusPill status={addon.delistedAt ? 'delisted' : 'listed'} />
		</>
	);
}

/**
 * @description The addons they own or maintain, as rows that open each addon.
 * @param props The addons to list.
 * @returns The addon list.
 */
export function AddonList({ addons }: AddonListProps) {
	if (addons.length === 0) {
		return (
			<Card className='flex-row items-center gap-3 p-(--card-pad)'>
				<IconBox className='size-5 text-muted-foreground' />
				<Text variant='text-sm' color='muted'>
					Maintains no addons.
				</Text>
			</Card>
		);
	}

	return (
		<Card className='gap-0 p-0 divide-y divide-border overflow-hidden'>
			{addons.map((addon) => (
				<Link
					key={addon.id}
					to='/admin/addons/$id'
					params={{ id: addon.id }}
					className='group flex items-center gap-3 hover:bg-muted/30 px-4 py-3'
				>
					<div className='flex justify-center items-center bg-accent rounded-control size-8 shrink-0'>
						<IconBox className='size-4' />
					</div>
					<div className='flex flex-col flex-1 gap-1 sm:gap-0 min-w-0'>
						<span className='font-medium truncate'>{addon.name}</span>
						<span className='font-mono text-muted-foreground text-xs truncate'>
							{addon.id}
						</span>
						{/* On a phone the details drop under the name so the name keeps the width. */}
						<span className='sm:hidden flex flex-wrap items-center gap-1.5'>
							<AddonMeta addon={addon} />
						</span>
					</div>
					<span className='hidden sm:flex items-center gap-3'>
						<AddonMeta addon={addon} />
					</span>
					<IconChevronRight className='size-4 text-muted-foreground group-hover:text-foreground' />
				</Link>
			))}
		</Card>
	);
}

export default { UserHeader, Standing, UserFacts, AddonList };
