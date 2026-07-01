import { SVG } from '~/api/metro/common';

type UnboundIconProps = {
	width?: number | string;
	height?: number | string;
	color?: string;
};

/**
 * @description The Unbound logo, rendered as a themeable SVG using the metro `Svg`/`Path` components.
 */
function Unbound({ width = '100%', height = '100%', color = 'currentColor' }: UnboundIconProps) {
	return (
		<SVG.Svg
			xmlns='http://www.w3.org/2000/svg'
			width={width}
			height={height}
			version='1.1'
			viewBox='0 0 512 512'
		>
			<SVG.Path
				fill={color}
				d='M1030 670l20 145 230 .416v.416a158.168 185 0 01129.79 94.584H1320a-60 72.5 0 00-60 72.5-60 72.5 0 0060 72.5h102.647A158.168 185 0 011280 1185v.416l-155-.416 20 145 135 .416c148.653 0 272.033-118.94 295.832-275.02L1790 1055l60-145-281.299.41C1533.085 771.904 1417.32 670.416 1280 670.416L1030 670z'
				transform='scale(.26458)'
			/>
			<SVG.Path
				fill={color}
				d='M620 605c-137.32 0-253.088 101.49-288.703 240H155L95 990h229.172c23.807 156.07 147.18 275 295.828 275h300l-20-145H620v-.416A158.168 185 0 01477.354 990H580a60 72.5 0 0060-72.5 60 72.5 0 00-60-72.5h-89.79A158.168 185 0 01620 750.416V750h210l-20-145H620z'
				transform='scale(.26458)'
			/>
		</SVG.Svg>
	);
}

export default Unbound;
