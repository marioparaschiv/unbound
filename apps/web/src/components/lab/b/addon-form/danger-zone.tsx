import { IconEye, IconSwap, IconViewMinusSign } from 'nucleo-micro-bold';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useMutation } from '@tanstack/react-query';
import type { ReactNode } from 'react';
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
import { transferAddonMutation } from '~/queries/admin-addons/addon-mutations';
import type { AdminAddonRecord } from '~/lib/admin-addon';
import getApiErrorMessage from '~/lib/api/error-message';
import UserSearch from '~/components/admin/user-search';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

import type { SettingsForm } from './use-settings-form';

type DangerZoneProps = {
	form: SettingsForm;
	addon: AdminAddonRecord;
	initiallyDelisted: boolean;
	canDelist: boolean;
	canTransfer: boolean;
};

type DangerRowProps = {
	title: string;
	description: ReactNode;
	children: ReactNode;
};

type TransferDialogProps = {
	addon: AdminAddonRecord;
	disabled: boolean;
};

function DangerRow({ title, description, children }: DangerRowProps) {
	return (
		<div className='flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 py-4 first:pt-0 last:pb-0'>
			<div className='flex flex-col gap-1 min-w-0'>
				<Text variant='text-sm' className='font-semibold'>
					{title}
				</Text>
				<Text as='div' variant='text-sm' color='muted'>
					{description}
				</Text>
			</div>
			<div className='shrink-0'>{children}</div>
		</div>
	);
}

function TransferDialog({ addon, disabled }: TransferDialogProps) {
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<UserSummary | null>(null);
	const transfer = useMutation(transferAddonMutation());
	const owners = new Set(addon.owners.map((owner) => owner.id));

	async function confirm() {
		if (!selected) return;

		try {
			await transfer.mutateAsync({ id: addon.id, userId: selected.id });
		} catch (error) {
			toast.error(getApiErrorMessage(error));

			return;
		}

		setOpen(false);
		toast.success(`${selected.name} now owns ${addon.id}`);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant='destructive' disabled={disabled}>
					<IconSwap size={24} />
					Transfer ownership
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transfer {addon.id}</DialogTitle>
					<DialogDescription>
						Pick the new owner. The current owners stay on as maintainers. This takes
						effect immediately.
					</DialogDescription>
				</DialogHeader>
				<UserSearch
					id={`b-transfer-${addon.id}`}
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
					<Button
						variant='outline'
						onClick={() => setOpen(false)}
						disabled={transfer.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={() => void confirm()}
						disabled={transfer.isPending || !selected}
					>
						<IconSwap size={24} />
						Transfer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DangerZone({ form, addon, initiallyDelisted, canDelist, canTransfer }: DangerZoneProps) {
	return (
		<div className='flex flex-col px-(--card-pad) py-(--card-pad) border border-destructive/30 rounded-surface divide-y divide-border'>
			{canDelist ? (
				<form.Field name='delisted'>
					{(field) => {
						// The row describes the saved state; a pending flip only changes its description.
						const delisted = initiallyDelisted;
						const pending = field.state.value !== initiallyDelisted;

						return (
							<DangerRow
								title={delisted ? 'Relist this addon' : 'Delist this addon'}
								description={
									pending ? (
										<>
											{delisted
												? 'Will be listed again when you save.'
												: 'Will be delisted when you save.'}{' '}
											<Button
												type='button'
												variant='link'
												size='sm'
												className='px-0 h-auto text-sm'
												onClick={() =>
													field.handleChange(initiallyDelisted)
												}
											>
												Undo
											</Button>
										</>
									) : delisted ? (
										'Hidden from listings, the catalog and update checks. Existing installs keep working.'
									) : (
										'Hides it from listings, the catalog and update checks. Published files stay up, so existing installs keep working.'
									)
								}
							>
								<Button
									type='button'
									variant={delisted ? 'secondary' : 'destructive'}
									disabled={pending}
									onClick={() => field.handleChange(!delisted)}
								>
									{delisted ? (
										<IconEye size={24} />
									) : (
										<IconViewMinusSign size={24} />
									)}
									{delisted ? 'Relist' : 'Delist'}
								</Button>
							</DangerRow>
						);
					}}
				</form.Field>
			) : null}
			{canTransfer ? (
				<form.Subscribe selector={(state) => !state.isDefaultValue}>
					{(dirty) => (
						<DangerRow
							title='Transfer ownership'
							description={
								dirty
									? 'Save or discard your changes first; a transfer reloads this form.'
									: 'Make another user the owner. Current owners stay on as maintainers.'
							}
						>
							<TransferDialog addon={addon} disabled={dirty} />
						</DangerRow>
					)}
				</form.Subscribe>
			) : null}
		</div>
	);
}

export default DangerZone;
