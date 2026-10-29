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

type AddonMoveProps = {
	addon: AdminAddon;
};

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
 * @description Hands the addon to a new owner at once; the current owners stay on as maintainers.
 * @param props The addon.
 * @returns The Transfer ownership button and its dialog.
 */
export function TransferButton({ addon }: AddonMoveProps) {
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<UserSummary | null>(null);
	const transfer = useMutation(transferAddonMutation());
	const owners = new Set(addon.owners.map((owner) => owner.id));

	function confirm() {
		if (!selected) return;

		setOpen(false);
		void run(
			transfer.mutateAsync({ id: addon.id, userId: selected.id }),
			`${selected.name} now owns ${addon.id}`,
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant='outline' size='sm' disabled={transfer.isPending}>
					<IconSwap size={24} />
					Transfer ownership
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transfer {addon.id}</DialogTitle>
					<DialogDescription>
						Pick the new owner. This happens right away; the current owners stay on as
						maintainers.
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
					<Button variant='outline' onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={confirm} disabled={!selected}>
						<IconSwap size={24} />
						Transfer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * @description Delists or relists at once, for staff who may delist but not edit the addon.
 * @param props The addon.
 * @returns The Delist or Relist button.
 */
export function ListingToggle({ addon }: AddonMoveProps) {
	const delist = useMutation(delistAddonMutation());
	const relist = useMutation(relistAddonMutation());
	const pending = delist.isPending || relist.isPending;

	if (addon.delistedAt) {
		return (
			<Button
				variant='secondary'
				size='sm'
				disabled={pending}
				onClick={() => void run(relist.mutateAsync(addon.id), `Relisted ${addon.id}`)}
			>
				<IconEye size={24} />
				Relist
			</Button>
		);
	}

	return (
		<ConfirmDialog
			trigger={
				<Button variant='destructive' size='sm' disabled={pending}>
					<IconViewMinusSign size={24} />
					Delist
				</Button>
			}
			title={`Delist ${addon.id}?`}
			description='It disappears from listings and update checks. Its published files stay up, so existing installs keep working. You can relist it later.'
			confirmLabel='Delist Addon'
			onConfirm={() => void run(delist.mutateAsync(addon.id), `Delisted ${addon.id}`)}
		/>
	);
}

export default { TransferButton, ListingToggle };
