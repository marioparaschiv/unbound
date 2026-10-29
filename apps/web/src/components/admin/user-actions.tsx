import { IconBan, IconChevronDown, IconUserCheck, IconUserPen } from 'nucleo-micro-bold';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import { useId } from 'react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
	banUserMutation,
	setRoleMutation,
	unbanUserMutation,
} from '~/queries/admin-users/user-mutations';
import getApiErrorMessage from '~/lib/api/error-message';
import ConfirmDialog from '~/components/confirm-dialog';
import type { AdminUser } from '~/lib/admin-users';
import { isRole, roles } from '~/lib/auth/access';
import { Button } from '~/components/ui/button';
import type { Role } from '~/lib/auth/access';
import Input from '~/components/ui/input';
import Label from '~/components/ui/label';

type UserActionsProps = {
	user: AdminUser;
	canSetRole: boolean;
	canBan: boolean;
	isSelf: boolean;
};

type RoleMenuProps = {
	user: AdminUser;
	disabled: boolean;
	onSetRole: (role: Role) => void;
};

type BanDialogProps = {
	user: AdminUser;
	disabled: boolean;
	onBan: (reason: string) => Promise<void>;
};

const ROLES = Object.keys(roles).filter(isRole);

function RoleMenu({ user, disabled, onSetRole }: RoleMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='outline' size='sm' disabled={disabled}>
					<IconUserPen size={24} />
					Role
					<IconChevronDown className='size-3' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{ROLES.map((role) => (
					<DropdownMenuItem
						key={role}
						onClick={() => onSetRole(role)}
						disabled={user.role === role}
						className='capitalize'
					>
						{role}
						{user.role === role ? ' (current)' : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function BanDialog({ user, disabled, onBan }: BanDialogProps) {
	const reasonId = useId();
	const form = useForm({
		defaultValues: { reason: '' },
		onSubmit: ({ value }) => onBan(value.reason),
	});

	return (
		<ConfirmDialog
			trigger={
				<Button variant='destructive' size='sm' disabled={disabled}>
					<IconBan size={24} />
					Ban
				</Button>
			}
			title={`Ban ${user.name}?`}
			description='They are signed out everywhere, their API keys stop working, and their open submissions are cancelled and their staged files deleted.'
			confirmLabel='Ban User'
			onConfirm={() => void form.handleSubmit()}
		>
			<form.Field name='reason'>
				{(field) => (
					<div className='flex flex-col gap-2'>
						<Label htmlFor={reasonId}>Reason (optional)</Label>
						<Input
							id={reasonId}
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
							onBlur={field.handleBlur}
							placeholder='Recorded with the ban, e.g. spam submissions'
						/>
					</div>
				)}
			</form.Field>
		</ConfirmDialog>
	);
}

function UserActions({ user, canSetRole, canBan, isSelf }: UserActionsProps) {
	const setRole = useMutation(setRoleMutation());
	const ban = useMutation(banUserMutation());
	const unban = useMutation(unbanUserMutation());
	// Staff cannot act on themselves, so no write here changes the signed-in session.
	const disabled = isSelf || setRole.isPending || ban.isPending || unban.isPending;

	// Awaited rather than `mutate(..., { onSuccess })`: on a filtered list the write can drop this row, and
	// per-call callbacks skip an unmounted caller.
	async function run<T>(action: Promise<T>, success: string) {
		try {
			await action;
		} catch (error) {
			toast.error(getApiErrorMessage(error));

			return;
		}

		toast.success(success);
	}

	return (
		<div className='flex justify-end items-center gap-2'>
			{canSetRole ? (
				<RoleMenu
					user={user}
					disabled={disabled}
					onSetRole={(role) =>
						void run(
							setRole.mutateAsync({ userId: user.id, role }),
							`${user.name} is now ${role}`,
						)
					}
				/>
			) : null}
			{canBan && user.banned ? (
				<Button
					variant='secondary'
					size='sm'
					onClick={() => void run(unban.mutateAsync(user.id), `Unbanned ${user.name}`)}
					disabled={disabled}
				>
					<IconUserCheck size={24} />
					Unban
				</Button>
			) : null}
			{canBan && !user.banned ? (
				<BanDialog
					user={user}
					disabled={disabled}
					onBan={(reason) =>
						run(
							ban.mutateAsync({
								userId: user.id,
								banReason: reason.trim() || undefined,
							}),
							`Banned ${user.name}`,
						)
					}
				/>
			) : null}
		</div>
	);
}

export default UserActions;
