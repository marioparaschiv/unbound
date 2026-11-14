import type { UnboundLogSource } from '@unbound-app/types';
import { View } from 'react-native';
import { memo } from 'react';

import { formatLogTime } from '~/logs/entry';
import { Discord } from '~/metro/components';

import type { LogLine } from './use-log-stream';

import useStyles from './log-row.style';

type LogRowProps = {
	line: LogLine;
};

const SOURCE_STYLES: Record<UnboundLogSource, 'unbound' | 'js' | 'reactNative' | 'native'> = {
	unbound: 'unbound',
	js: 'js',
	'react-native': 'reactNative',
	native: 'native',
};

/**
 * @description One log line: its coloured source tag, level, scope and time over the message.
 */
function LogRow({ line }: LogRowProps) {
	const styles = useStyles();

	return (
		<View style={styles.row}>
			<View style={styles.meta}>
				<Discord.Text variant='text-xs/bold' style={styles[SOURCE_STYLES[line.src]]}>
					{line.src}
				</Discord.Text>
				<Discord.Text variant='text-xs/semibold' style={styles[line.lvl]}>
					{line.lvl}
				</Discord.Text>
				<Discord.Text
					variant='text-xs/medium'
					color='text-muted'
					numberOfLines={1}
					style={styles.scope}
				>
					{line.scope.join('/')}
				</Discord.Text>
				<Discord.Text variant='text-xs/medium' color='text-muted'>
					{formatLogTime(line.t)}
				</Discord.Text>
			</View>
			<Discord.Text variant='code' style={styles[line.lvl]} selectable>
				{line.msg}
			</Discord.Text>
		</View>
	);
}

export default memo(LogRow);
