import type { UserSummary } from '@unbound-app/contracts/account';
import { useRef, useState, useTransition } from 'react';
import { IconMagnifier } from 'nucleo-micro-bold';
import { toast } from 'sonner';

import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxStatus,
} from '~/components/ui/combobox';
import { InputGroupAddon } from '~/components/ui/input-group';
import getApiErrorMessage from '~/lib/api/error-message';
import { fetchAdminUsers } from '~/lib/admin-functions';
import UserAvatar from '~/components/user-avatar';

type UserSearchProps = {
	id: string;
	placeholder: string;
	className?: string;
	disabledIds?: ReadonlySet<string>;
	onPick: (user: UserSummary) => void;
};

type SearchResults = {
	matchedQuery: string;
	users: UserSummary[];
	failed: boolean;
};

const MIN_QUERY_LENGTH = 3;

const RESULT_LIMIT = 5;

const SEARCH_DEBOUNCE_MS = 300;

const NO_RESULTS: SearchResults = { matchedQuery: '', users: [], failed: false };

function describeStatus(query: string, results: SearchResults, isSearching: boolean) {
	if (query.length < MIN_QUERY_LENGTH) {
		return `Type at least ${MIN_QUERY_LENGTH} characters to search`;
	}

	if (isSearching || results.matchedQuery !== query) {
		return 'Searching...';
	}

	if (results.failed) {
		return 'Search failed';
	}

	return results.users.length === 0 ? 'No users found' : null;
}

function UserSearch({ id, placeholder, className, disabledIds, onPick }: UserSearchProps) {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState(NO_RESULTS);
	const [isSearching, startSearch] = useTransition();
	const activeQuery = useRef<string | null>(null);
	const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const status = describeStatus(query.trim(), results, isSearching);

	function search(q: string) {
		if (q.length < MIN_QUERY_LENGTH) {
			setResults({ matchedQuery: q, users: [], failed: false });

			return;
		}

		startSearch(async () => {
			try {
				const page = await fetchAdminUsers({ data: { q } });

				if (q !== activeQuery.current) return;

				setResults({
					matchedQuery: q,
					users: page.items.slice(0, RESULT_LIMIT),
					failed: false,
				});
			} catch (error) {
				if (q !== activeQuery.current) return;

				toast.error(getApiErrorMessage(error));
				setResults({ matchedQuery: q, users: [], failed: true });
			}
		});
	}

	function pick(user: UserSummary | null) {
		if (!user) return;

		clearTimeout(searchTimer.current);
		activeQuery.current = null;
		setQuery('');
		setResults(NO_RESULTS);
		onPick(user);
	}

	return (
		<Combobox
			items={results.users}
			filter={null}
			value={null}
			inputValue={query}
			itemToStringLabel={(user: UserSummary) => user.name}
			onValueChange={pick}
			onInputValueChange={(next, { reason }) => {
				// Picking fills the input with the user's name; `pick` clears it instead.
				if (reason === 'item-press') return;

				const q = next.trim();

				activeQuery.current = q;
				setQuery(next);
				clearTimeout(searchTimer.current);
				searchTimer.current = setTimeout(() => search(q), SEARCH_DEBOUNCE_MS);
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
