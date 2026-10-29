import { IconDots, IconEye, IconSwap, IconViewMinusSign } from 'nucleo-micro-bold';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '~/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
	delistAddonMutation,
	relistAddonMutation,
	transferAddonMutation,
} from '~/queries/admin-addons/addon-mutations';
import { Button, buttonVariants } from '~/components/ui/button';
import getApiErrorMessage from '~/lib/api/error-message';
import UserSearch from '~/components/admin/user-search';
import type { AdminAddon } from '~/lib/admin-addons';
import UserAvatar from '~/components/user-avatar';
import Text from '~/components/ui/text';

type AddonActionsProps = {
	addon: AdminAddon;
	canDelist: boolean;
	canTransfer: boolean;
	/** `menu` folds the actions behind one "…" button, for list rows. */
	layout?: 'buttons' | 'menu';
};

type DialogState = 'transfer' | 'delist' | null;

type ActionDialogsProps = {
	addon: AdminAddon;
	open: DialogState;
	onOpenChange: (open: DialogState) => void;
	pending: boolean;
	onTransfer: (user: UserSummary) => void;
	onDelist: () => void;
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

function ActionDialogs({
	addon,
	open,
	onOpenChange,
	pending,
	onTransfer,
	onDelist,
}: ActionDialogsProps) {
	const [selected, setSelected] = useState<UserSummary | null>(null);
	const owners = new Set(addon.owners.map((owner) => owner.id));

	return (
		<>
			<Dialog
				open={open === 'transfer'}
				onOpenChange={(next) => onOpenChange(next ? 'transfer' : null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Transfer ownership of {addon.name}</DialogTitle>
						<DialogDescription>
							Pick the new owner. The current owners stay on as maintainers.
						</DialogDescription>
					</DialogHeader>
					<UserSearch
						id={`lab-a-transfer-${addon.id}`}
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
						<Button variant='outline' onClick={() => onOpenChange(null)}>
							Cancel
						</Button>
						<Button
							disabled={pending || !selected}
							onClick={() => {
								if (!selected) return;

								onOpenChange(null);
								onTransfer(selected);
							}}
						>
							<IconSwap size={24} />
							Transfer Ownership
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={open === 'delist'}
				onOpenChange={(next) => onOpenChange(next ? 'delist' : null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delist {addon.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							It disappears from listings and update checks. Its published files stay
							up, so existing installs keep working. You can relist it later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className={buttonVariants({ variant: 'destructive' })}
							onClick={onDelist}
						>
							Delist Addon
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function AddonActions({ addon, canDelist, canTransfer, layout = 'buttons' }: AddonActionsProps) {
	const [dialog, setDialog] = useState<DialogState>(null);
	const delist = useMutation(delistAddonMutation());
	const relist = useMutation(relistAddonMutation());
	const transfer = useMutation(transferAddonMutation());
	const pending = delist.isPending || relist.isPending || transfer.isPending;

	if (!canDelist && !canTransfer) return null;

	function doRelist() {
		void run(relist.mutateAsync(addon.id), `Relisted ${addon.id}`);
	}

	const dialogs = (
		<ActionDialogs
			addon={addon}
			open={dialog}
			onOpenChange={setDialog}
			pending={pending}
			onTransfer={(user) =>
				void run(
					transfer.mutateAsync({ id: addon.id, userId: user.id }),
					`${user.name} now owns ${addon.id}`,
				)
			}
			onDelist={() => void run(delist.mutateAsync(addon.id), `Delisted ${addon.id}`)}
		/>
	);

	if (layout === 'menu') {
		return (
			<>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='icon-sm'
							aria-label={`Actions for ${addon.name}`}
							disabled={pending}
						>
							<IconDots size={24} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-56'>
						{canTransfer ? (
							<DropdownMenuItem onClick={() => setDialog('transfer')}>
								<IconSwap />
								Transfer ownership…
							</DropdownMenuItem>
						) : null}
						{canDelist && addon.delistedAt ? (
							<DropdownMenuItem onClick={doRelist}>
								<IconEye />
								Relist in the store
							</DropdownMenuItem>
						) : null}
						{canDelist && !addon.delistedAt ? (
							<DropdownMenuItem
								variant='destructive'
								onClick={() => setDialog('delist')}
							>
								<IconViewMinusSign />
								Delist from the store…
							</DropdownMenuItem>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
				{dialogs}
			</>
		);
	}

	return (
		<div className='flex flex-wrap items-center gap-2'>
			{canTransfer ? (
				<Button variant='outline' disabled={pending} onClick={() => setDialog('transfer')}>
					<IconSwap size={24} />
					Transfer Ownership
				</Button>
			) : null}
			{canDelist && addon.delistedAt ? (
				<Button variant='secondary' disabled={pending} onClick={doRelist}>
					<IconEye size={24} />
					Relist
				</Button>
			) : null}
			{canDelist && !addon.delistedAt ? (
				<Button
					variant='destructive'
					disabled={pending}
					onClick={() => setDialog('delist')}
				>
					<IconViewMinusSign size={24} />
					Delist
				</Button>
			) : null}
			{dialogs}
		</div>
	);
}

export default AddonActions;
