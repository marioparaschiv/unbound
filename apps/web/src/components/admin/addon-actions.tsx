import { addonResponseSchema, maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { IconEye, IconSwap, IconViewMinusSign } from 'nucleo-micro-bold';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useRouter } from '@tanstack/react-router';
import { useState, useTransition } from 'react';
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
import { createBrowserClient } from '~/lib/api/browser-client';
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

type AddonActionProps = {
	addon: AdminAddon;
	disabled: boolean;
	run: (action: () => Promise<void>, success: string) => void;
};

function DelistDialog({ addon, disabled, run }: AddonActionProps) {
	function delist() {
		run(async () => {
			await createBrowserClient()('POST /api/v1/addons/$id/delist', {
				params: { id: addon.id },
				response: addonResponseSchema,
			});
		}, `Delisted ${addon.id}`);
	}

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
			onConfirm={delist}
		/>
	);
}

function TransferDialog({ addon, disabled, run }: AddonActionProps) {
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<UserSummary | null>(null);
	const owners = new Set(addon.owners.map((owner) => owner.id));

	function transfer() {
		if (!selected) return;

		setOpen(false);
		run(async () => {
			await createBrowserClient()('POST /api/v1/addons/$id/transfer', {
				params: { id: addon.id },
				body: { userId: selected.id },
				response: maintainersResponseSchema,
			});
		}, `${selected.name} now owns ${addon.id}`);
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
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	function run(action: () => Promise<void>, success: string) {
		startTransition(async () => {
			try {
				await action();
			} catch (error) {
				toast.error(getApiErrorMessage(error));

				return;
			}

			await router.invalidate();
			toast.success(success);
		});
	}

	function relist() {
		run(async () => {
			await createBrowserClient()('POST /api/v1/addons/$id/relist', {
				params: { id: addon.id },
				response: addonResponseSchema,
			});
		}, `Relisted ${addon.id}`);
	}

	return (
		<div className='flex justify-end items-center gap-2'>
			{canTransfer ? <TransferDialog addon={addon} disabled={isPending} run={run} /> : null}
			{canDelist && addon.delistedAt ? (
				<Button variant='secondary' size='sm' onClick={relist} disabled={isPending}>
					<IconEye size={24} />
					Relist
				</Button>
			) : null}
			{canDelist && !addon.delistedAt ? (
				<DelistDialog addon={addon} disabled={isPending} run={run} />
			) : null}
		</div>
	);
}

export default AddonActions;
