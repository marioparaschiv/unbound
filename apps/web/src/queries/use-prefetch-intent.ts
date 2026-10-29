import type { FetchQueryOptions, QueryKey } from '@tanstack/react-query';
import { skipToken, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

type IntentHandlers = {
	onPointerEnter: () => void;
	onPointerLeave: () => void;
	onFocus: () => void;
	onBlur: () => void;
};

/**
 * @description Prefetches the query a click will read once the pointer rests on or focus reaches the element, like a `<Link>` preloads.
 * @template TQueryFnData The data the query function resolves to.
 * @template TError The error the query can fail with.
 * @template TData The data after `select`.
 * @template TQueryKey The query key.
 * @param options The query options the element's click leads to; a `skipToken` query is never prefetched.
 * @returns Handlers to spread on the element; leaving before the router's preload delay cancels the prefetch.
 */
function usePrefetchIntent<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
	options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): IntentHandlers {
	const queryClient = useQueryClient();
	const delay = useRouter().options.defaultPreloadDelay ?? 0;
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	function start() {
		if (options.queryFn === skipToken) return;

		timer.current ??= setTimeout(() => {
			timer.current = undefined;
			void queryClient.prefetchQuery(options);
		}, delay);
	}

	function cancel() {
		clearTimeout(timer.current);
		timer.current = undefined;
	}

	useEffect(() => () => clearTimeout(timer.current), []);

	return { onPointerEnter: start, onPointerLeave: cancel, onFocus: start, onBlur: cancel };
}

export default usePrefetchIntent;
