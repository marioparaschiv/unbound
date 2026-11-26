import { Discord } from '@unbound-app/api/metro/components';
import { ScrollView } from 'react-native';

import useStyles from '~/components/output-view.style';

type OutputViewProps = { output: string };

/**
 * @description Shows a program's output as Discord shows code: monospaced, left-aligned, in a card that scrolls when long.
 * @param props The output text.
 * @returns The card.
 */
export default function OutputView({ output }: OutputViewProps) {
	const styles = useStyles();

	return (
		<Discord.Card border='subtle' shadow='none' style={styles.card}>
			<ScrollView style={styles.scroll} nestedScrollEnabled>
				<Discord.Text variant='mono-md/normal' color='text-default' selectable>
					{output}
				</Discord.Text>
			</ScrollView>
		</Discord.Card>
	);
}
