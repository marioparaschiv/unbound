import { ADMIN_SEARCH_MIN_LENGTH } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { IconMagnifier } from 'nucleo-micro-bold';

import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxStatus,
} from '~/components/ui/combobox';
import type { UserSearchState } from '~/queries/admin-users/use-user-search';
import useUserSearch from '~/queries/admin-users/use-user-search';
import { InputGroupAddon } from '~/components/ui/input-group';
import UserAvatar from '~/components/user-avatar';

type UserSearchProps = {
	id: string;
	placeholder: string;
	className?: string;
	disabledIds?: ReadonlySet<string>;
	onPick: (user: UserSummary) => void;
};

const STATUS: Record<UserSearchState, string | null> = {
	short: `Type at least ${ADMIN_SEARCH_MIN_LENGTH} characters to search`,
	searching: 'Searching...',
	failed: 'Search failed',
	done: null,
};

function UserSearch({ id, placeholder, className, disabledIds, onPick }: UserSearchProps) {
	const { query, setQuery, clear, users, state } = useUserSearch();
	const status = state === 'done' && users.length === 0 ? 'No users found' : STATUS[state];

	function pick(user: UserSummary | null) {
		if (!user) return;

		clear();
		onPick(user);
	}

	return (
		<Combobox
			items={users}
			filter={null}
			value={null}
			inputValue={query}
			itemToStringLabel={(user: UserSummary) => user.name}
			onValueChange={pick}
			onInputValueChange={(next, { reason }) => {
				// Picking fills the input with the user's name; `pick` clears it instead.
				if (reason === 'item-press') return;

				setQuery(next);
			}}
		>
			<ComboboxInput
				id={id}
				className={className}
				placeholder={placeholder}
				autoComplete='off'
			>
				<InputGroupAddon>
					<IconMagnifier size={24} />
				</InputGroupAddon>
			</ComboboxInput>
			<ComboboxContent className='min-w-64'>
				<ComboboxStatus>{status}</ComboboxStatus>
				<ComboboxList>
					{(user: UserSummary) => (
						<ComboboxItem
							key={user.id}
							value={user}
							disabled={disabledIds?.has(user.id)}
						>
							<UserAvatar src={user.image} name={user.name} size='xs' />
							<span className='single-line min-w-0 flex-1'>{user.name}</span>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

export default UserSearch;
