import { IconBan, IconUserCheck } from 'nucleo-micro-bold';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import { useId } from 'react';

import {
	banUserMutation,
	setRoleMutation,
	unbanUserMutation,
} from '~/queries/admin-users/user-mutations';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import { formatDateTime } from '~/components/admin/format-date';
import type { AdminUserRecord } from '~/lib/admin-users';
import getApiErrorMessage from '~/lib/api/error-message';
import ConfirmDialog from '~/components/confirm-dialog';
import { isRole, roles } from '~/lib/auth/access';
import { Button } from '~/components/ui/button';
import type { Role } from '~/lib/auth/access';
import Input from '~/components/ui/input';
import Label from '~/components/ui/label';
import Text from '~/components/ui/text';

type ControlProps = {
	user: AdminUserRecord;
	/** Staff cannot act on themselves, so no write here changes the signed-in session. */
	disabled: boolean;
};

const ROLE_LABELS = Object.fromEntries(
	Object.keys(roles)
		.filter(isRole)
		.map((role) => [role, role.charAt(0).toUpperCase() + role.slice(1)]),
) as Record<Role, string>;

async function run<T>(action: Promise<T>, success: string) {
	try {
		await action;
	} catch (error) {
		toast.error(getApiErrorMessage(error));

		return;
	}

	toast.success(success);
}

/**
 * @description The user's role as a select that applies the moment it changes.
 * @param props The user and whether the control is locked.
 * @returns The role control.
 */
export function RoleControl({ user, disabled }: ControlProps) {
	const setRole = useMutation(setRoleMutation());

	return (
		<div className='flex flex-col gap-2 max-w-xs'>
			<Label htmlFor='b-user-role'>Role</Label>
			<Select
				items={ROLE_LABELS}
				value={user.role}
				disabled={disabled || setRole.isPending}
				onValueChange={(role) => {
					if (!role || !isRole(role) || role === user.role) return;

					void run(
						setRole.mutateAsync({ userId: user.id, role }),
						`${user.name} is now ${role}`,
					);
				}}
			>
				<SelectTrigger id='b-user-role' className='w-full'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{Object.entries(ROLE_LABELS).map(([role, label]) => (
						<SelectItem key={role} value={role}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

/**
 * @description The user's ban state with the one action that changes it.
 * @param props The user and whether the control is locked.
 * @returns The ban control.
 */
export function BanControl({ user, disabled }: ControlProps) {
	const reasonId = useId();
	const ban = useMutation(banUserMutation());
	const unban = useMutation(unbanUserMutation());
	const busy = disabled || ban.isPending || unban.isPending;
	const form = useForm({
		defaultValues: { reason: '' },
		onSubmit: ({ value }) =>
			run(
				ban.mutateAsync({ userId: user.id, banReason: value.reason.trim() || undefined }),
				`Banned ${user.name}`,
			),
	});

	if (user.banned) {
		return (
			<div className='flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3'>
				<div className='flex flex-col gap-1 min-w-0'>
					<Text
						variant='text-sm'
						className='inline-flex items-center gap-1.5 font-semibold text-destructive'
					>
						<IconBan className='size-4' />
						Banned
						{user.banExpires ? ` until ${formatDateTime(user.banExpires)}` : null}
					</Text>
					<Text variant='text-sm' color='muted'>
						{user.banReason ? `Reason: ${user.banReason}` : 'No reason was recorded.'}
					</Text>
				</div>
				<Button
					variant='secondary'
					disabled={busy}
					onClick={() => void run(unban.mutateAsync(user.id), `Unbanned ${user.name}`)}
				>
					<IconUserCheck size={24} />
					Unban
				</Button>
			</div>
		);
	}

	return (
		<div className='flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3'>
			<Text variant='text-sm' color='muted'>
				Signs them out everywhere, stops their API keys, and cancels their open submissions.
			</Text>
			<ConfirmDialog
				trigger={
					<Button variant='destructive' disabled={busy}>
						<IconBan size={24} />
						Ban user
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
		</div>
	);
}

export default { RoleControl, BanControl };
