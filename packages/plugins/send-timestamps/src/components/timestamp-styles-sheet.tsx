import { Discord } from '@unbound-app/api/metro/components';
import { ScrollView } from 'react-native';
import { assets } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { previewTimestamp } from '~/lib/preview';
import { timestamp, TIMESTAMP_STYLES, type TimestampStyle } from '~/lib/timestamps';

import styles from '~/components/timestamp-styles-sheet.style';

type TimestampStylesSheetProps = {
	moment: Date;
	onInsert: (markup: string) => void;
	onCopy: (markup: string) => void;
	onChangeTime: () => void;
};

const STYLE_NAMES: Record<TimestampStyle, keyof typeof messages> = {
	R: 'NAME_RELATIVE',
	t: 'NAME_SHORT_TIME',
	T: 'NAME_LONG_TIME',
	d: 'NAME_SHORT_DATE',
	D: 'NAME_LONG_DATE',
	f: 'NAME_SHORT_FULL',
	F: 'NAME_LONG_FULL',
};

function TimestampStylesSheet({
	moment,
	onInsert,
	onCopy,
	onChangeTime,
}: TimestampStylesSheetProps) {
	const copyIcon = assets.getIdByName('CopyIcon');

	return (
		<Discord.ActionSheet startExpanded>
			<ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
				<Discord.TableRowGroup title={messages.STYLES_TITLE}>
					{TIMESTAMP_STYLES.map((style) => {
						const markup = timestamp(moment, style);
						const name = messages[STYLE_NAMES[style]];

						return (
							<Discord.TableRow
								key={style}
								label={previewTimestamp(moment, style)}
								subLabel={`${name} · ${markup}`}
								onPress={() => onInsert(markup)}
								trailing={
									<Discord.IconButton
										size='sm'
										variant='secondary'
										icon={copyIcon}
										accessibilityLabel={format('COPY_STYLE_LABEL', {
											style: name,
										})}
										onPress={() => onCopy(markup)}
									/>
								}
							/>
						);
					})}
				</Discord.TableRowGroup>
				<Discord.Button
					variant='secondary'
					text={messages.CHANGE_TIME}
					onPress={onChangeTime}
				/>
			</ScrollView>
		</Discord.ActionSheet>
	);
}

export default TimestampStylesSheet;
