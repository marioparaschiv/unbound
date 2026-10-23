import type { MaintainerRole } from '@unbound-app/contracts/addons';
import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { IconX } from '@tabler/icons-react';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import UserSearch from '~/components/admin/user-search';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type MaintainerEditorProps = {
	id: string;
	members: MaintainerEntry[];
	users: Record<string, UserSummary>;
	onChange: (members: MaintainerEntry[]) => void;
	/** Called with a user picked from search, before they are added. */
	onPick: (user: UserSummary) => void;
};

const ROLE_LABELS: Record<MaintainerRole, string> = {
	owner: 'Owner',
	maintainer: 'Maintainer',
};

function MaintainerEditor({ id, members, users, onChange, onPick }: MaintainerEditorProps) {
	const listed = new Set(members.map((member) => member.userId));

	function add(user: UserSummary) {
		onPick(user);
		onChange([...members, { userId: user.id, role: 'maintainer' }]);
	}

	function setRole(userId: string, role: MaintainerRole) {
		onChange(members.map((member) => (member.userId === userId ? { userId, role } : member)));
	}

	function remove(userId: string) {
		onChange(members.filter((member) => member.userId !== userId));
	}

	return (
		<div className='flex flex-col gap-2'>
			<ul className='flex flex-col gap-1'>
				{members.map((member) => {
					const known = users[member.userId];

					return (
						<li
							key={member.userId}
							className='flex items-center gap-3 px-2 py-1 border border-border rounded-md'
						>
							<UserAvatar
								src={known?.image ?? null}
								name={known?.name ?? member.userId}
								size='xs'
							/>
							<Text
								as='span'
								variant='text-sm'
								className='single-line min-w-0 flex-1'
							>
								{known?.name ?? member.userId}
							</Text>
							<Select
								items={ROLE_LABELS}
								value={member.role}
								onValueChange={(role) => {
									if (role) {
										setRole(member.userId, role);
									}
								}}
							>
								<SelectTrigger
									size='sm'
									className='w-32'
									aria-label={`Role of ${known?.name ?? member.userId}`}
								>
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
							<Button
								type='button'
								variant='ghost'
								size='icon'
								className='size-7'
								aria-label={`Remove ${known?.name ?? member.userId}`}
								onClick={() => remove(member.userId)}
							>
								<IconX className='size-4' />
							</Button>
						</li>
					);
				})}
			</ul>
			<UserSearch
				id={id}
				placeholder='Add a maintainer: search users by name...'
				disabledIds={listed}
				onPick={add}
			/>
		</div>
	);
}

export default MaintainerEditor;
