import type { ErrorInfo } from 'react';

interface ErrorBoundaryProps extends React.PropsWithChildren {
	state: {
		error: Error;
		info: ErrorInfo;
	};
}


/* TODO: finish this */
export default class ErrorBoundary extends React.PureComponent<ErrorBoundaryProps> {
	render() {
		const { state } = this.props;

		if (state?.error) {
			return <ReactNative.ScrollView style={{ backgroundColor: 'white' }}>
				<ReactNative.Text>
					{state.error.message}
				</ReactNative.Text>
				<ReactNative.Text style={{ marginTop: 10 }}>
					{state.info.componentStack}
				</ReactNative.Text>
			</ReactNative.ScrollView>;
		}

		return this.props.children;
	}
}