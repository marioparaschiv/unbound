import { Modal, Pressable, useWindowDimensions, View } from 'react-native';

import { tooltipPlacement, type TooltipAnchor } from '~/tooltip-placement';
import { Tooltips } from '~/modules';

import useStyles from './typing-tooltip.style';

type TypingTooltipProps = {
	anchor: TooltipAnchor;
	label: string;
	onClose: () => void;
};

function TypingTooltip({ anchor, label, onClose }: TypingTooltipProps) {
	const styles = useStyles();
	const { width: viewportWidth } = useWindowDimensions();
	const placement = tooltipPlacement(anchor, label.length, viewportWidth);

	return (
		<Modal visible transparent statusBarTranslucent onRequestClose={onClose}>
			<View style={{ flex: 1 }}>
				<Pressable onPress={onClose} style={styles.backdrop} />
				<View
					pointerEvents='none'
					style={{ left: placement.left, position: 'absolute', top: placement.top }}
				>
					<Tooltips.Tooltip
						arrowDirection={placement.arrowDirection}
						arrowOffset={placement.arrowOffset}
						arrowPosition={Tooltips.TooltipArrowPositions.LEFT}
						arrowStyle={styles.arrow}
						containerStyle={styles.bubble}
						label={label}
						labelStyle={styles.label}
						style={{ width: placement.width }}
					/>
				</View>
			</View>
		</Modal>
	);
}

export default TypingTooltip;
