import { View } from 'react-native';

import { Discord } from '~/metro/components';
import { nearestSlot } from '~/fonts/slots';
import { Manager } from '~/addons/manager';
import { format } from '~/i18n/api';

import useStyles from './font-preview.style';
import FontSample from './font-sample';

type FontPreviewProps = {
	/** One Discord family per line, each drawing its override; a heading, a message and code when omitted. */
	lines?: { key: string; family: string; label: string }[];
};

const CODE = 'const answer = 42;';

// The Discord family a group draws at a weight, so the line shows that group's override.
function familyOf(group: string, weight: number): string | undefined {
	return nearestSlot(Manager.for('font').getSlots(group), weight)?.families[0];
}

/**
 * @description The Preview card: a heading, a message and a code line, each in the Discord family its
 * group draws, or one labelled line per weight when `lines` is given. Its parent re-renders it on changes.
 */
function FontPreview({ lines }: FontPreviewProps) {
	const styles = useStyles();

	return (
		<View>
			<Discord.TableRowGroupTitle title={format('UNBOUND_FONTS_PREVIEW')} />
			<Discord.Card variant='secondary' border='none' style={styles.card}>
				{lines ? (
					lines.map((line) => (
						<View key={line.key} style={styles.line}>
							<FontSample
								text={format('UNBOUND_FONTS_PREVIEW_SAMPLE')}
								family={line.family}
								variant='heading-md/medium'
							/>
							<Discord.Text variant='text-xs/medium' color='text-muted'>
								{line.label}
							</Discord.Text>
						</View>
					))
				) : (
					<>
						<FontSample
							text={format('UNBOUND_FONTS_PREVIEW_HEADING')}
							family={familyOf('DISPLAY', 600)}
							variant='heading-lg/semibold'
						/>
						<View style={styles.line}>
							<FontSample
								text={format('UNBOUND_FONTS_PREVIEW_AUTHOR')}
								family={familyOf('PRIMARY', 600)}
							/>
							<FontSample
								text={format('UNBOUND_FONTS_PREVIEW_MESSAGE')}
								family={familyOf('PRIMARY', 400)}
								lines={2}
							/>
						</View>
						<FontSample
							text={CODE}
							family={familyOf('CODE', 400)}
							variant='text-sm/normal'
						/>
					</>
				)}
			</Discord.Card>
		</View>
	);
}

export default FontPreview;
