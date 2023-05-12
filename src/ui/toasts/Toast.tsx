import { Constants, React, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { InternalToastOptions } from '@typings/api/toasts';
import Toasts from '@stores/toasts';
import { Icons } from '@api/assets';

class Toast extends React.Component<InternalToastOptions> {
	state = { timeout: null, leaving: false };

	render() {
		if (this.state.leaving) {
			this.remove();
		}

		return <RN.Animated.View style={this.styles.container}>
			<RN.View style={this.styles.contentContainer}>
				{this.renderHeader()}
				{this.renderContent()}
			</RN.View>
			<RN.TouchableOpacity
				style={this.styles.close}
				activeOpacity={0.5}
				onPress={this.remove.bind(this)}
			>
				<RN.Image
					source={Icons['ic_close']}
					style={this.styles.close}
				/>
			</RN.TouchableOpacity>
		</RN.Animated.View>;
	}

	renderHeader() {
		const { icon, title } = this.props;

		return <>
			{Icons[icon] && <RN.Image
				source={Icons[icon]}
				style={this.styles.icon}
			/>}
			<RN.Text style={this.styles.title}>
				{title}
			</RN.Text>
		</>;
	}

	renderContent() {
		const { content } = this.props;

		return <RN.Text style={this.styles.content}>
			{typeof content === 'function' ? React.createElement(content) : content}
		</RN.Text>;
	}

	componentDidMount() {
		const { duration } = this.props;
		if (!duration) return;

		this.setState({ timeout: setTimeout(() => this.setState({ leaving: true }), duration) });
	}

	remove() {
		const { id } = this.props;

		Toasts.store.setState((prev) => {
			delete prev.toasts[id];
			return prev;
		});
	}

	styles = StyleSheet.createThemedStyleSheet({
		container: {
			backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
			marginHorizontal: 100,
			alignItems: 'center',
			justifyContent: 'center',
			alignContent: 'center',
			flexDirection: 'row',
			alignSelf: 'center',
			borderRadius: 25,
			marginTop: 100,
			height: 55,
			width: 200,
			padding: 20,
			position: 'relative',
			zIndex: 2,
			...Theme.shadows.SHADOW_BORDER
		},
		contentContainer: {
			flexDirection: 'row',
			flex: 1,
			alignItems: 'center',
			justifyContent: 'center',
			alignContent: 'center',
			alignSelf: 'center',
		},
		title: {
			fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
			color: Theme.colors.TEXT_NORMAL
		},
		content: {
			color: Theme.colors.TEXT_MUTED
		},
		icon: {
			width: 24,
			height: 24,
			marginRight: 15
		},
		progress: {

		},
		close: {
			width: 24,
			height: 24,
			justifyContent: 'flex-end',
			flex: 1,
			alignItems: 'flex-end'
		}
	});
}

export default Toast;