import type { MaintainerRole } from '@unbound-app/contracts/addons';
import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useMemo, useState, useTransition } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import debounce from '@unbound-app/utils/debounce';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';

import getApiErrorMessage from '~/lib/api/error-message';
import { fetchAdminUsers } from '~/lib/admin-functions';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type MaintainerEditorProps = {
	id: string;
	members: MaintainerEntry[];
	/** Names and avatars of every user the list may show, by id. */
	users: Record<string, UserSummary>;
	onChange: (members: MaintainerEntry[]) => void;
	/** Called with a user picked from search, before they are added. */
	onPick: (user: UserSummary) => void;
};

const ROLE_LABELS: Record<MaintainerRole, string> = {
	owner: 'Owner',
	maintainer: 'Maintainer',
};

const SELECT_CLASS =
	'border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

const SEARCH_RESULTS = 5;

const SEARCH_DEBOUNCE_MS = 300;

function isRole(value: string): value is MaintainerRole {
	return Object.hasOwn(ROLE_LABELS, value);
}

function MaintainerEditor({ id, members, users, onChange, onPick }: MaintainerEditorProps) {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<UserSummary[]>([]);
	const [isSearching, startSearch] = useTransition();
	const listed = new Set(members.map((member) => member.userId));

	const searchLater = useMemo(
		() =>
			debounce((q: string) => {
				if (q.length < 3) {
					setResults([]);

					return;
				}

				startSearch(async () => {
					try {
						const page = await fetchAdminUsers({ data: { q } });

						setResults(page.items.slice(0, SEARCH_RESULTS));
					} catch (error) {
						toast.error(getApiErrorMessage(error));
					}
				});
			}, SEARCH_DEBOUNCE_MS),
		[],
	);

	function handleSearch(event: ChangeEvent<HTMLInputElement>) {
		setQuery(event.target.value);
		searchLater(event.target.value.trim());
	}

	function add(user: UserSummary) {
		setQuery('');
		setResults([]);
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
							<Text as='span' variant='text-sm' className='flex-1 truncate'>
								{known?.name ?? member.userId}
							</Text>
							<select
								aria-label={`Role of ${known?.name ?? member.userId}`}
								className={SELECT_CLASS}
								value={member.role}
								onChange={(event) => {
									const role = event.target.value;

									if (isRole(role)) {
										setRole(member.userId, role);
									}
								}}
							>
								{Object.entries(ROLE_LABELS).map(([role, label]) => (
									<option key={role} value={role}>
										{label}
									</option>
								))}
							</select>
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
			<div className='relative'>
				<Input
					id={id}
					placeholder='Add a maintainer: search users by name...'
					value={query}
					onChange={handleSearch}
					autoComplete='off'
				/>
				{results.length > 0 || isSearching ? (
					<div className='top-full left-0 z-10 absolute flex flex-col gap-1 bg-popover shadow-md mt-1 p-1 border border-border rounded-md w-full'>
						{isSearching && results.length === 0 ? (
							<Text variant='text-sm' color='muted' className='px-3 py-2'>
								Searching...
							</Text>
						) : null}
						{results.map((user) => (
							<button
								key={user.id}
								type='button'
								disabled={listed.has(user.id)}
								onClick={() => add(user)}
								className='flex items-center gap-3 hover:bg-accent/50 disabled:opacity-50 px-3 py-2 rounded-md text-left transition-colors disabled:pointer-events-none'
							>
								<UserAvatar src={user.image} name={user.name} size='xs' />
								<Text as='span' variant='text-sm' className='flex-1 truncate'>
									{user.name}
								</Text>
								{listed.has(user.id) ? null : <IconPlus className='size-4' />}
							</button>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}

export default MaintainerEditor;
