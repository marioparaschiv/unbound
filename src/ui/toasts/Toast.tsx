import { Constants, React, ReactNative as RN, StyleSheet, Theme, Reanimated } from '@metro/common';
import { InternalToastOptions } from '@typings/api/toasts';
import Toasts from '@stores/toasts';
import { Icons } from '@api/assets';
import { Animated } from '@metro/components';
import { toasts } from '@stores/toasts';

// class Toast extends React.Component<InternalToastOptions> {
// 	state = { timeout: null, leaving: false };

// 	render() {
// 		if (this.state.leaving) {
// 			this.remove();
// 		}

// 		return <RN.Animated.View style={this.styles.container}>
// 			<RN.View style={this.styles.contentContainer}>
// 				{this.renderHeader()}
// 				{this.renderContent()}
// 			</RN.View>
// 			<RN.TouchableOpacity
// 				style={this.styles.close}
// 				activeOpacity={0.5}
// 				onPress={this.remove.bind(this)}
// 			>
// 				<RN.Image
// 					source={Icons['ic_close']}
// 					style={this.styles.close}
// 				/>
// 			</RN.TouchableOpacity>
// 		</RN.Animated.View>;
// 	}

// 	renderHeader() {
// 		const { icon, title } = this.props;

// 		return <>
// 			{Icons[icon] && <RN.Image
// 				source={Icons[icon]}
// 				style={this.styles.icon}
// 			/>}
// 			<RN.Text style={this.styles.title}>
// 				{title}
// 			</RN.Text>
// 		</>;
// 	}

// 	renderContent() {
// 		const { content } = this.props;

// 		return <RN.Text style={this.styles.content}>
// 			{typeof content === 'function' ? React.createElement(content) : content}
// 		</RN.Text>;
// 	}

// 	componentDidMount() {
// 		const { duration } = this.props;
// 		if (!duration) return;

// 		this.setState({ timeout: setTimeout(() => this.setState({ leaving: true }), duration) });
// 	}

// 	remove() {
// 		const { id } = this.props;

// 		Toasts.store.setState((prev) => {
// 			delete prev.toasts[id];
// 			return prev;
// 		});
// 	}

// 	styles = StyleSheet.createThemedStyleSheet({
// 		container: {
// 			backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
// 			marginHorizontal: 100,
// 			alignItems: 'center',
// 			justifyContent: 'center',
// 			alignContent: 'center',
// 			flexDirection: 'row',
// 			alignSelf: 'center',
// 			borderRadius: 25,
// 			marginTop: 100,
// 			height: 55,
// 			width: 200,
// 			padding: 20,
// 			position: 'relative',
// 			zIndex: 2,
// 			...Theme.shadows.SHADOW_BORDER
// 		},
// 		contentContainer: {
// 			flexDirection: 'row',
// 			flex: 1,
// 			alignItems: 'center',
// 			justifyContent: 'center',
// 			alignContent: 'center',
// 			alignSelf: 'center',
// 		},
// 		title: {
// 			fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
// 			color: Theme.colors.TEXT_NORMAL
// 		},
// 		content: {
// 			color: Theme.colors.TEXT_MUTED
// 		},
// 		icon: {
// 			width: 24,
// 			height: 24,
// 			marginRight: 15
// 		},
// 		progress: {

// 		},
// 		close: {
// 			width: 24,
// 			height: 24,
// 			justifyContent: 'flex-end',
// 			flex: 1,
// 			alignItems: 'flex-end'
// 		}
// 	});
// }

const styles = StyleSheet.createThemedStyleSheet({
	main: {
		backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
		marginHorizontal: 100,
		alignItems: 'center',
		justifyContent: 'center',
		alignContent: 'center',
		flexDirection: 'row',
		alignSelf: 'center',
		borderRadius: 25,
		height: 55,
		width: 200,
		padding: 20,
		position: 'relative',
		zIndex: 9999999999999,
		...Theme.shadows.SHADOW_BORDER
	},
	text: {
		color: Theme.colors.TEXT_NORMAL,
	},
	container: {
		position: 'absolute',
		padding: 10,
		borderRadius: 18,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'center',
		top: 50
	}
});

function Toast(options: InternalToastOptions) {
	const width = Reanimated.useSharedValue(50);

	const style = Reanimated.useAnimatedStyle(() => {
		return {
			width: Reanimated.withTiming(width.value, {
				duration: 2000,
				easing: Reanimated.Easing.bezier(0.25, 0.1, 0.25, 1),
			}),
		};
	});

	// React.useEffect(() => {
	// setTimeout(() => {
	// width.value = 200;
	// }, 500);
	// }, []);

	return (
		<Animated.View style={[styles.main, styles.container, style]}>
			<RN.Button onPress={() => (width.value = Math.random() * 300)} title="Hey" />
		</Animated.View>
	);
	// const [dimensions, setDimensions] = React.useState(null);
	// const [showing, setShowing] = React.useState(true);
	// const TOP_VALUE = RN.Platform.OS === 'ios' ? 60 : 20;
	// // const height = Reanimated.useSharedValue(dimensions?.height ?? 0);
	// const y = Reanimated.useSharedValue(100);
	// // const opacity = Reanimated.useSharedValue(1);


	// // React.useEffect(() => {
	// // }, []);

	// const enter = Reanimated.useAnimatedStyle(() => ({
	// 	top: y.value
	// }));

	// // const leave = Reanimated.useEvent(() => [], ['leave']);

	// React.useEffect(() => {
	// 	y.value = Reanimated.withSequence(
	// 		Reanimated.withTiming(TOP_VALUE),
	// 		Reanimated.withDelay(
	// 			options.duration,
	// 			Reanimated.withTiming(100, null, finished => {
	// 				if (finished) {
	// 					toasts.setState(prev => {
	// 						delete prev.toasts[options.id];
	// 						return prev;
	// 					});
	// 				}
	// 			}),
	// 		),
	// 	);
	// }, []);

	// return showing && <Animated.View
	// 	style={[styles.container, enter]}
	// 	entering={enter}
	// 	onLayout={(event) => setDimensions(event.nativeEvent.layout)}
	// // entering={(props) => { }}
	// >
	// 	<Animated.View style={styles.main}>
	// 		<RN.Text style={styles.text}>
	// 			{options.content}
	// 		</RN.Text>
	// 	</Animated.View>
	// </Animated.View>;
};

export default Toast;