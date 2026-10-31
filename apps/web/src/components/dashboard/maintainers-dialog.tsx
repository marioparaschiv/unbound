import { useMutation, useQuery } from '@tanstack/react-query';
import { IconUser, IconUserPlus } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '~/components/ui/input-group';
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
import MaintainerRow from '~/components/maintainer-row';
import RoleTag from '~/components/dashboard/role-tag';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';

type MaintainersDialogProps = {
	addonId: string;
	/** The signed-in owner; removing themselves ends their access to this dialog. */
	userId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

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
					<DialogTitle>Maintainers</DialogTitle>
					<DialogDescription>Who can publish updates to {addonId}.</DialogDescription>
				</DialogHeader>

				{data ? (
					<ul className='flex flex-col -mx-2'>
						{data.maintainers.map((maintainer) => (
							<MaintainerRow
								key={maintainer.id}
								maintainer={maintainer}
								badge={<RoleTag role={maintainer.role} />}
								disabled={isPending}
								onRemove={() => remove(maintainer.id)}
							/>
						))}
					</ul>
				) : error ? (
					<Text variant='text-sm' color='destructive'>
						{getApiErrorMessage(error)}
					</Text>
				) : (
					<Spinner className='mx-auto' />
				)}

				<form
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<form.Field name='userId'>
						{(field) => (
							<InputGroup data-disabled={isPending}>
								<InputGroupAddon>
									<IconUser />
								</InputGroupAddon>
								<InputGroupInput
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									placeholder='User ID'
									aria-label='User ID'
									className='font-mono'
									disabled={isPending}
									required
								/>
								<InputGroupAddon align='inline-end'>
									<InputGroupButton
										type='submit'
										disabled={isPending || !field.state.value.trim()}
									>
										{addition.isPending ? (
											<Spinner />
										) : (
											<IconUserPlus size={24} />
										)}
										Add
									</InputGroupButton>
								</InputGroupAddon>
							</InputGroup>
						)}
					</form.Field>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default MaintainersDialog;
