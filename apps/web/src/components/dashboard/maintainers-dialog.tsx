import type { Maintainer } from '@unbound-app/contracts/addons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { IconUserPlus, IconXmark } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';

import {
	addMaintainerMutation,
	maintainersQuery,
	removeMaintainerMutation,
} from '~/queries/dashboard/maintainers';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '~/components/ui/dialog';
import getApiErrorMessage from '~/lib/api/error-message';
import RoleTag from '~/components/dashboard/role-tag';
import Separator from '~/components/ui/separator';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type MaintainersDialogProps = {
	addonId: string;
	/** The signed-in owner; removing themselves ends their access to this dialog. */
	userId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type MaintainerRowProps = {
	maintainer: Maintainer;
	disabled: boolean;
	onRemove: (userId: string) => void;
};

function MaintainerRow({ maintainer, disabled, onRemove }: MaintainerRowProps) {
	return (
		<div className='flex justify-between items-center gap-4'>
			<div className='flex items-center gap-3 min-w-0'>
				<UserAvatar src={maintainer.image} name={maintainer.name} size='sm' />
				<div className='flex flex-col min-w-0'>
					<div className='flex items-center gap-2'>
						<Text variant='text-sm' className='font-medium truncate'>
							{maintainer.name}
						</Text>
						<RoleTag role={maintainer.role} />
					</div>
					<Text variant='text-xs' color='muted' className='font-mono truncate'>
						{maintainer.id}
					</Text>
				</div>
			</div>

			<Button
				variant='outline'
				size='sm'
				disabled={disabled}
				onClick={() => onRemove(maintainer.id)}
			>
				<IconXmark size={14} />
				Remove
			</Button>
		</div>
	);
}

function MaintainersDialog({ addonId, userId, open, onOpenChange }: MaintainersDialogProps) {
	const { data, error } = useQuery({ ...maintainersQuery(addonId), enabled: open });
	const addition = useMutation(addMaintainerMutation(addonId));
	const removal = useMutation(removeMaintainerMutation(addonId));
	const isPending = addition.isPending || removal.isPending;
	const form = useForm({
		defaultValues: { userId: '' },
		onSubmit: ({ value }) => {
			addition.mutate(value.userId.trim(), {
				onSuccess: () => form.reset(),
				onError: (cause) => toast.error(getApiErrorMessage(cause)),
			});
		},
	});

	function remove(memberId: string) {
		removal.mutate(memberId, {
			onSuccess: () => {
				if (memberId === userId) {
					onOpenChange(false);
				}
			},
			onError: (cause) => toast.error(getApiErrorMessage(cause)),
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Maintainers of {addonId}</DialogTitle>
					<DialogDescription>
						Maintainers can publish updates. Add someone by the user ID shown on their
						dashboard.
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<form.Field name='userId'>
						{(field) => (
							<div className='flex gap-2'>
								<Input
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									placeholder='User ID'
									aria-label='User ID'
									className='font-mono'
									disabled={isPending}
									required
								/>
								<Button
									type='submit'
									disabled={isPending || !field.state.value.trim()}
								>
									<IconUserPlus size={24} />
									Add
								</Button>
							</div>
						)}
					</form.Field>
				</form>

				{data ? (
					<div className='flex flex-col gap-3'>
						{data.maintainers.map((maintainer) => (
							<div key={maintainer.id} className='flex flex-col gap-3'>
								<Separator />
								<MaintainerRow
									maintainer={maintainer}
									disabled={isPending}
									onRemove={remove}
								/>
							</div>
						))}
					</div>
				) : error ? (
					<Text variant='text-sm' color='destructive'>
						{getApiErrorMessage(error)}
					</Text>
				) : (
					<Spinner className='mx-auto' />
				)}
			</DialogContent>
		</Dialog>
	);
}

export default MaintainersDialog;
