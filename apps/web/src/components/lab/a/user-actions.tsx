import { IconBan, IconChevronDown, IconDots, IconUserCheck } from 'nucleo-micro-bold';
import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import {
	banUserMutation,
	setRoleMutation,
	unbanUserMutation,
} from '~/queries/admin-users/user-mutations';
import { Button, buttonVariants } from '~/components/ui/button';
import getApiErrorMessage from '~/lib/api/error-message';
import type { AdminUser } from '~/lib/admin-users';
import { isRole, roles } from '~/lib/auth/access';
import Input from '~/components/ui/input';
import Label from '~/components/ui/label';

type UserActionsProps = {
	user: AdminUser;
	canSetRole: boolean;
	canBan: boolean;
	isSelf: boolean;
	/** `menu` folds the actions behind one "…" button, for list rows. */
	layout?: 'buttons' | 'menu';
};

type BanDialogProps = {
	user: AdminUser;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onBan: (reason: string) => void;
};

const ROLES = Object.keys(roles).filter(isRole);

async function run<T>(action: Promise<T>, success: string) {
	try {
		await action;
	} catch (error) {
		toast.error(getApiErrorMessage(error));

		return;
	}

	toast.success(success);
}

function BanDialog({ user, open, onOpenChange, onBan }: BanDialogProps) {
	const reasonId = useId();
	const [reason, setReason] = useState('');

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Ban {user.name}?</AlertDialogTitle>
					<AlertDialogDescription>
						They are signed out everywhere, their API keys stop working, and their open
						submissions are cancelled and their staged files deleted.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className='flex flex-col gap-2'>
					<Label htmlFor={reasonId}>Reason (optional)</Label>
					<Input
						id={reasonId}
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						placeholder='Recorded with the ban, e.g. spam submissions'
					/>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className={buttonVariants({ variant: 'destructive' })}
						onClick={() => onBan(reason)}
					>
						Ban User
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function UserActions({ user, canSetRole, canBan, isSelf, layout = 'buttons' }: UserActionsProps) {
	const [banning, setBanning] = useState(false);
	const setRole = useMutation(setRoleMutation());
	const ban = useMutation(banUserMutation());
	const unban = useMutation(unbanUserMutation());
	// Staff cannot act on themselves, so no write here changes the signed-in session.
	const disabled = isSelf || setRole.isPending || ban.isPending || unban.isPending;

	if (!canSetRole && !canBan) return null;

	function changeRole(role: string) {
		if (!isRole(role) || role === user.role) return;

		void run(setRole.mutateAsync({ userId: user.id, role }), `${user.name} is now ${role}`);
	}

	function doUnban() {
		void run(unban.mutateAsync(user.id), `Unbanned ${user.name}`);
	}

	const banDialog = (
		<BanDialog
			user={user}
			open={banning}
			onOpenChange={setBanning}
			onBan={(reason) =>
				void run(
					ban.mutateAsync({ userId: user.id, banReason: reason.trim() || undefined }),
					`Banned ${user.name}`,
				)
			}
		/>
	);

	const roleItems = (
		<DropdownMenuRadioGroup value={user.role} onValueChange={changeRole}>
			{ROLES.map((role) => (
				<DropdownMenuRadioItem key={role} value={role} className='capitalize'>
					{role}
				</DropdownMenuRadioItem>
			))}
		</DropdownMenuRadioGroup>
	);

	if (layout === 'menu') {
		return (
			<>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='icon-sm'
							aria-label={`Actions for ${user.name}`}
							disabled={disabled}
						>
							<IconDots size={24} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-52'>
						{canSetRole ? (
							<>
								<DropdownMenuLabel className='text-muted-foreground text-xs'>
									Change role
								</DropdownMenuLabel>
								{roleItems}
							</>
						) : null}
						{canSetRole && canBan ? <DropdownMenuSeparator /> : null}
						{canBan && user.banned ? (
							<DropdownMenuItem onClick={doUnban}>
								<IconUserCheck />
								Unban user
							</DropdownMenuItem>
						) : null}
						{canBan && !user.banned ? (
							<DropdownMenuItem
								variant='destructive'
								onClick={() => setBanning(true)}
							>
								<IconBan />
								Ban user…
							</DropdownMenuItem>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
				{banDialog}
			</>
		);
	}

	return (
		<div className='flex flex-wrap items-center gap-2'>
			{canSetRole ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='outline' disabled={disabled}>
							<span className='capitalize'>Role: {user.role}</span>
							<IconChevronDown className='size-3' />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-48'>
						{roleItems}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
			{canBan && user.banned ? (
				<Button variant='secondary' disabled={disabled} onClick={doUnban}>
					<IconUserCheck size={24} />
					Unban
				</Button>
			) : null}
			{canBan && !user.banned ? (
				<Button variant='destructive' disabled={disabled} onClick={() => setBanning(true)}>
					<IconBan size={24} />
					Ban
				</Button>
			) : null}
			{banDialog}
		</div>
	);
}

export default UserActions;
