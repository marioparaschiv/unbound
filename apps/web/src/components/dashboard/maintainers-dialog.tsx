import type { Maintainer, MaintainersResponse } from '@unbound-app/contracts/addons';
import { maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { useEffect, useState, useTransition } from 'react';
import { IconUserPlus, IconX } from '@tabler/icons-react';
import { useRouter } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '~/components/ui/dialog';
import { createBrowserClient } from '~/lib/api/browser-client';
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
				<IconX size={14} />
				Remove
			</Button>
		</div>
	);
}

function MaintainersDialog({ addonId, userId, open, onOpenChange }: MaintainersDialogProps) {
	const router = useRouter();
	const [maintainers, setMaintainers] = useState<Maintainer[] | null>(null);
	const [newUserId, setNewUserId] = useState('');
	const [isPending, startTransition] = useTransition();

	function run(action: () => Promise<MaintainersResponse>) {
		startTransition(async () => {
			try {
				const response = await action();

				setMaintainers(response.maintainers);
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}
		});
	}

	useEffect(() => {
		if (!open) return;

		run(() =>
			createBrowserClient()('GET /api/v1/addons/$id/maintainers', {
				params: { id: addonId },
				response: maintainersResponseSchema,
			}),
		);
	}, [open, addonId]);

	function add(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const target = newUserId.trim();

		run(async () => {
			const response = await createBrowserClient()('POST /api/v1/addons/$id/maintainers', {
				params: { id: addonId },
				body: { userId: target },
				response: maintainersResponseSchema,
			});

			setNewUserId('');

			return response;
		});
	}

	function remove(memberId: string) {
		run(async () => {
			const response = await createBrowserClient()(
				'DELETE /api/v1/addons/$id/maintainers/$userId',
				{
					params: { id: addonId, userId: memberId },
					response: maintainersResponseSchema,
				},
			);

			if (memberId === userId) {
				onOpenChange(false);
				await router.invalidate();
			}

			return response;
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

				<form onSubmit={add} className='flex gap-2'>
					<Input
						value={newUserId}
						onChange={(event) => setNewUserId(event.target.value)}
						placeholder='User ID'
						aria-label='User ID'
						className='font-mono'
						disabled={isPending}
						required
					/>
					<Button type='submit' disabled={isPending || !newUserId.trim()}>
						<IconUserPlus />
						Add
					</Button>
				</form>

				{maintainers ? (
					<div className='flex flex-col gap-3'>
						{maintainers.map((maintainer) => (
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
				) : (
					<Spinner className='mx-auto' />
				)}
			</DialogContent>
		</Dialog>
	);
}

export default MaintainersDialog;
