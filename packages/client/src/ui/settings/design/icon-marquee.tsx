import type { ImageURISource, LayoutChangeEvent } from 'react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import IconMarqueeRow from './icon-marquee-row';
import useStyles from './icon-marquee.style';

type IconMarqueeProps = {
	icons: ImageURISource[];
};

type Size = { width: number; height: number };

/** A row's button height plus the gap below it. */
const ROW_HEIGHT = 72;
/** The marquee's vertical padding less the last row's gap. */
const SPARE_HEIGHT = 16;
/** How long a row takes to travel one icon; rows vary around it so they drift apart. */
const MS_PER_SLOT = 1600;
const ROW_PACE = [1, 0.8, 1.15, 0.9, 1.05, 0.85];

/**
 * @description Every icon a pack draws, in rows that scroll past forever, alternating direction, as many rows as fit.
 * Each row takes every n-th icon, so neighbouring rows show different ones.
 */
function IconMarquee({ icons }: IconMarqueeProps) {
	const styles = useStyles();
	const [size, setSize] = useState<Size>();
	const count = size
		? Math.max(1, Math.min(icons.length, Math.floor((size.height - SPARE_HEIGHT) / ROW_HEIGHT)))
		: 0;
	const rows = useMemo(
		() =>
			Array.from({ length: count }, (_, row) =>
				icons.filter((_, index) => index % count === row),
			),
		[icons, count],
	);

	function measure({ nativeEvent: { layout } }: LayoutChangeEvent) {
		setSize({ width: layout.width, height: layout.height });
	}

	return (
		<View style={styles.marquee} onLayout={measure}>
			{size
				? rows.map((row, index) => (
						<IconMarqueeRow
							key={index}
							icons={row}
							width={size.width}
							reverse={index % 2 === 1}
							msPerSlot={MS_PER_SLOT * ROW_PACE[index % ROW_PACE.length]}
						/>
					))
				: null}
		</View>
	);
}

export default IconMarquee;
