import { React, ReactNative } from '@metro/common';

export default class extends React.PureComponent {
  state = { error: null, errorInfo: null };

  render() {
    if (this.state.error) {
      return <ReactNative.ScrollView>
        <ReactNative.Text>
          {this.state.error}
        </ReactNative.Text>
        <ReactNative.Text style={{ marginTop: 10 }}>
          {this.state.errorInfo}
        </ReactNative.Text>
      </ReactNative.ScrollView>;
    }

    return this.props.children;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ error: error.message, errorInfo: errorInfo.componentStack });
  }
}