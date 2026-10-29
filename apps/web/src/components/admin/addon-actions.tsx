import { IconEye, IconSwap, IconViewMinusSign } from 'nucleo-micro-bold';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

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
	delistAddonMutation,
	relistAddonMutation,
	transferAddonMutation,
} from '~/queries/admin-addons/addon-mutations';
import getApiErrorMessage from '~/lib/api/error-message';
import UserSearch from '~/components/admin/user-search';
import ConfirmDialog from '~/components/confirm-dialog';
import type { AdminAddon } from '~/lib/admin-addons';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type AddonActionsProps = {
	addon: AdminAddon;
	canDelist: boolean;
	canTransfer: boolean;
};

type DelistDialogProps = {
	addon: AdminAddon;
	disabled: boolean;
	onDelist: () => void;
};

type TransferDialogProps = {
	addon: AdminAddon;
	disabled: boolean;
	onTransfer: (user: UserSummary) => void;
};

function DelistDialog({ addon, disabled, onDelist }: DelistDialogProps) {
	return (
		<ConfirmDialog
			trigger={
				<Button variant='destructive' size='sm' disabled={disabled}>
					<IconViewMinusSign size={24} />
					Delist
				</Button>
			}
			title={`Delist ${addon.id}?`}
			description='It disappears from listings and update checks. Its published files stay up, so existing installs keep working. You can relist it later.'
			confirmLabel='Delist Addon'
			onConfirm={onDelist}
		/>
	);
}

function TransferDialog({ addon, disabled, onTransfer }: TransferDialogProps) {
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<UserSummary | null>(null);
	const owners = new Set(addon.owners.map((owner) => owner.id));

	function transfer() {
		if (!selected) return;

		setOpen(false);
		onTransfer(selected);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant='outline' size='sm' disabled={disabled}>
					<IconSwap size={24} />
					Transfer
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transfer {addon.id}</DialogTitle>
					<DialogDescription>
						Pick the new owner. The current owners stay on as maintainers.
					</DialogDescription>
				</DialogHeader>
				<UserSearch
					id={`transfer-${addon.id}`}
					placeholder='Search users...'
					disabledIds={owners}
					onPick={setSelected}
				/>
				{selected ? (
					<div className='flex items-center gap-3 bg-accent px-3 py-2 rounded-control'>
						<UserAvatar src={selected.image} name={selected.name} size='xs' />
						<Text as='span' variant='text-sm' className='flex-1 truncate'>
							{selected.name}
						</Text>
					</div>
				) : null}
				<DialogFooter>
					<Button variant='outline' onClick={() => setOpen(false)} disabled={disabled}>
						Cancel
					</Button>
					<Button onClick={transfer} disabled={disabled || !selected}>
						<IconSwap size={24} />
						Transfer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function AddonActions({ addon, canDelist, canTransfer }: AddonActionsProps) {
	const delist = useMutation(delistAddonMutation());
	const relist = useMutation(relistAddonMutation());
	const transfer = useMutation(transferAddonMutation());
	const isPending = delist.isPending || relist.isPending || transfer.isPending;

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
			{canTransfer ? (
				<TransferDialog
					addon={addon}
					disabled={isPending}
					onTransfer={(user) =>
						void run(
							transfer.mutateAsync({ id: addon.id, userId: user.id }),
							`${user.name} now owns ${addon.id}`,
						)
					}
				/>
			) : null}
			{canDelist && addon.delistedAt ? (
				<Button
					variant='secondary'
					size='sm'
					onClick={() => void run(relist.mutateAsync(addon.id), `Relisted ${addon.id}`)}
					disabled={isPending}
				>
					<IconEye size={24} />
					Relist
				</Button>
			) : null}
			{canDelist && !addon.delistedAt ? (
				<DelistDialog
					addon={addon}
					disabled={isPending}
					onDelist={() => void run(delist.mutateAsync(addon.id), `Delisted ${addon.id}`)}
				/>
			) : null}
		</div>
	);
}

export default AddonActions;
