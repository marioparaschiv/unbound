import type { UnboundLogEntry, UnboundNativeLogs } from '@unbound-app/types';
import { useEffect, useRef, useState } from 'react';

import { appendLogEntries, mergeLogEntries } from '~/logs/merge';
import { readLogTail } from '~/logs/tail';

/** A log entry with an id that stays the same while the page shows it. */
export type LogLine = UnboundLogEntry & { id: number };

/**
 * @description Streams log lines while the calling component is mounted: the newest lines already on disk, then
 * every new one. Unmounting unsubscribes and drops them all.
 * @param logs The loader's log stream.
 * @returns The lines, oldest first, capped at the newest few hundred.
 */
function useLogStream(logs: UnboundNativeLogs): LogLine[] {
	const [lines, setLines] = useState<LogLine[]>([]);
	const nextId = useRef(0);

	useEffect(() => {
		const withIds = (entries: UnboundLogEntry[]) =>
			entries.map((entry) => ({ ...entry, id: nextId.current++ }));
		// Lines from before subscribing are only on disk; later ones arrive live, so the tail stops here.
		const since = Date.now();
		let mounted = true;

		function handler(batch: UnboundLogEntry[]) {
			setLines((previous) => appendLogEntries(previous, withIds(batch)));
		}

		const unsubscribe = logs.subscribe(handler);

		void readLogTail().then((tail) => {
			if (!mounted) return;

			const older = withIds(tail.filter((entry) => entry.t < since));

			setLines((previous) => mergeLogEntries([older, previous]));
		});

		return () => {
			mounted = false;
			unsubscribe();
		};
	}, [logs]);

	return lines;
}

export default useLogStream;
