import { IconBan, IconChevronDown, IconUserCheck, IconUserPen } from 'nucleo-micro-bold';
import { useId, useState, useTransition } from 'react';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import type { AuthClientError } from '~/lib/auth/error-message';
import getAuthErrorMessage from '~/lib/auth/error-message';
import ConfirmDialog from '~/components/confirm-dialog';
import type { AdminUser } from '~/lib/admin-users';
import { isRole, roles } from '~/lib/auth/access';
import { Button } from '~/components/ui/button';
import type { Role } from '~/lib/auth/access';
import authClient from '~/lib/auth/client';
import Input from '~/components/ui/input';
import Label from '~/components/ui/label';

type UserActionsProps = {
	user: AdminUser;
	canSetRole: boolean;
	canBan: boolean;
	isSelf: boolean;
};

type UserActionProps = {
	user: AdminUser;
	disabled: boolean;
	run: (action: () => Promise<AuthClientError | null>, success: string) => void;
};

const ROLES = Object.keys(roles).filter(isRole);

function RoleMenu({ user, disabled, run }: UserActionProps) {
	function setRole(role: Role) {
		run(async () => {
			const { error } = await authClient.admin.setRole({ userId: user.id, role });

			return error;
		}, `${user.name} is now ${role}`);
	}

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
						onSelect={() => setRole(role)}
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

function BanDialog({ user, disabled, run }: UserActionProps) {
	const reasonId = useId();
	const [reason, setReason] = useState('');

	function ban() {
		run(async () => {
			const { error } = await authClient.admin.banUser({
				userId: user.id,
				banReason: reason.trim() || undefined,
			});

			return error;
		}, `Banned ${user.name}`);
	}

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
			onConfirm={ban}
		>
			<div className='flex flex-col gap-2'>
				<Label htmlFor={reasonId}>Reason (optional)</Label>
				<Input
					id={reasonId}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					placeholder='Recorded with the ban, e.g. spam submissions'
				/>
			</div>
		</ConfirmDialog>
	);
}

function UserActions({ user, canSetRole, canBan, isSelf }: UserActionsProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const disabled = isPending || isSelf;

	function run(action: () => Promise<AuthClientError | null>, success: string) {
		startTransition(async () => {
			const error = await action();

			if (error) {
				toast.error(getAuthErrorMessage(error));

				return;
			}

			await router.invalidate();
			toast.success(success);
		});
	}

	function unban() {
		run(async () => {
			const { error } = await authClient.admin.unbanUser({ userId: user.id });

			return error;
		}, `Unbanned ${user.name}`);
	}

	return (
		<div className='flex justify-end items-center gap-2'>
			{canSetRole ? <RoleMenu user={user} disabled={disabled} run={run} /> : null}
			{canBan && user.banned ? (
				<Button variant='secondary' size='sm' onClick={unban} disabled={disabled}>
					<IconUserCheck size={24} />
					Unban
				</Button>
			) : null}
			{canBan && !user.banned ? (
				<BanDialog user={user} disabled={disabled} run={run} />
			) : null}
		</div>
	);
}

export default UserActions;
