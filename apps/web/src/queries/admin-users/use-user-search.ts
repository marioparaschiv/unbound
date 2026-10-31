import { ADMIN_SEARCH_MIN_LENGTH } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { userSearchQuery } from '~/queries/admin-users/admin-users';
import getApiErrorMessage from '~/lib/api/error-message';

/** Where a picker's search stands: `short` until the text reaches the search minimum. */
export type UserSearchState = 'short' | 'searching' | 'failed' | 'done';

export type UserSearch = {
	/** What the input shows. */
	query: string;
	setQuery: (query: string) => void;
	/** Empties the input, e.g. after a pick. */
	clear: () => void;
	/** The matches for the current text; empty unless `state` is `done`. */
	users: UserSummary[];
	state: UserSearchState;
};

// Long enough to skip the keystrokes of a name being typed, short enough to feel live.
const SEARCH_DEBOUNCE_MS = 300;

/**
 * @description Drives a staff user picker: the input's text, and the users matching it once typing pauses.
 * @returns The input state, the matches and where the search stands.
 */
function useUserSearch(): UserSearch {
	const [query, setQuery] = useState('');
	const term = query.trim();
	const [settled, setSettled] = useState(term);
	const { data, error, isFetching, isPending, isPlaceholderData } = useQuery(
		userSearchQuery(settled),
	);

	useEffect(() => {
		const timer = setTimeout(() => setSettled(term), SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timer);
	}, [term]);

	useEffect(() => {
		if (error) {
			toast.error(getApiErrorMessage(error));
		}
	}, [error]);

	function state(): UserSearchState {
		if (term.length < ADMIN_SEARCH_MIN_LENGTH) {
			return 'short';
		}

		if (settled !== term) {
			return 'searching';
		}

		if (error && !isFetching) {
			return 'failed';
		}

		// The previous text's matches stay cached under it; they are not this text's.
		return isPending || isPlaceholderData ? 'searching' : 'done';
	}

	const current = state();

	return {
		query,
		setQuery,
		clear: () => {
			setQuery('');
			setSettled('');
		},
		users: current === 'done' ? (data ?? []) : [],
		state: current,
	};
}

export default useUserSearch;
