import { Component, type ReactNode } from 'react';

type IndicatorBoundaryProps = { children: ReactNode };
type IndicatorBoundaryState = { failed: boolean };

// A broken indicator hides itself instead of taking the channel row down with it.
class IndicatorBoundary extends Component<IndicatorBoundaryProps, IndicatorBoundaryState> {
	state = { failed: false };

	static getDerivedStateFromError(): IndicatorBoundaryState {
		return { failed: true };
	}

	componentDidCatch(error: Error): void {
		console.error('Channel typing indicator failed:', error);
	}

	render(): ReactNode {
		return this.state.failed ? null : this.props.children;
	}
}

export default IndicatorBoundary;
