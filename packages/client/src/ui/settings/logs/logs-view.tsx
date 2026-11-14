import type { UnboundNativeLogs } from '@unbound-app/types';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, View } from 'react-native';

import { LOG_SEGMENTS, filterLogEntries, type LogSegment } from '~/logs/filter';
import { Discord, SafeArea } from '~/metro/components';
import FlashList from '~/ui/components/flash-list';
import Empty from '~/ui/components/empty-state';
import { messages, format } from '~/i18n/api';

import useLogStream, { type LogLine } from './use-log-stream';
import LogsActions from './logs-actions';
import useStyles from './logs.style';
import LogRow from './log-row';

type LogsViewProps = {
	logs: UnboundNativeLogs;
};

const SEGMENT_LABELS = {
	all: 'UNBOUND_LOGS_ALL',
	js: 'UNBOUND_LOGS_JS',
	'react-native': 'UNBOUND_LOGS_REACT_NATIVE',
	native: 'UNBOUND_LOGS_NATIVE',
} as const satisfies Record<LogSegment, keyof typeof messages>;

const keyOf = (line: LogLine) => String(line.id);

const renderRow = ({ item }: { item: LogLine }) => <LogRow line={item} />;

/**
 * @description The live Logs page: search, pause, copy and share over a source filter, then the lines newest first.
 */
function LogsView({ logs }: LogsViewProps) {
	const styles = useStyles();
	const lines = useLogStream(logs);
	const [segment, setSegment] = useState<LogSegment>('all');
	const [unboundOnly, setUnboundOnly] = useState(false);
	const [search, setSearch] = useState('');
	const [frozen, setFrozen] = useState<LogLine[] | undefined>(undefined);
	const shown = frozen ?? lines;
	const matching = useMemo(
		() => filterLogEntries(shown, { segment, unboundOnly, search }),
		[shown, segment, unboundOnly, search],
	);
	const newestFirst = useMemo(() => [...matching].reverse(), [matching]);

	const items = useMemo(
		() => LOG_SEGMENTS.map((id) => ({ id, label: messages[SEGMENT_LABELS[id]] })),
		[],
	);
	const picked = LOG_SEGMENTS.indexOf(segment);
	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: picked,
		onSetActiveIndex(index: number) {
			setSegment(LOG_SEGMENTS[index] ?? 'all');
		},
	});

	useEffect(() => {
		if (state.activeIndex !== picked) {
			state.setActiveIndex(picked);
		}
	}, [picked]);

	return (
		<View style={styles.fill}>
			<View style={styles.header}>
				<Discord.Stack direction='horizontal' spacing={8} align='center'>
					<View style={styles.search}>
						<Discord.SearchBar
							size='md'
							value={search}
							onChange={setSearch}
							placeholder={format('UNBOUND_SEARCH', { type: messages.UNBOUND_LOGS })}
						/>
					</View>
					<LogsActions
						lines={matching}
						paused={Boolean(frozen)}
						onTogglePause={() => setFrozen(frozen ? undefined : lines)}
					/>
				</Discord.Stack>
				<Discord.SegmentedControl state={state} />
				<Discord.TableSwitchRow
					label={messages.UNBOUND_LOGS_UNBOUND_ONLY}
					value={unboundOnly}
					onValueChange={setUnboundOnly}
					start
					end
				/>
			</View>
			<FlashList
				data={newestFirst}
				keyExtractor={keyOf}
				renderItem={renderRow}
				estimatedItemSize={56}
				ListEmptyComponent={
					<Empty icon={search ? undefined : 'PaperIcon'}>
						{search ? messages.UNBOUND_EMPTY_RESULTS : messages.UNBOUND_LOGS_EMPTY}
					</Empty>
				}
				// The bottom inset pads the end of the list, so the rows scroll under the home indicator.
				ListFooterComponent={<SafeArea.SafeAreaPaddingView bottom />}
				keyboardDismissMode='on-drag'
			/>
		</View>
	);
}

export default LogsView;
