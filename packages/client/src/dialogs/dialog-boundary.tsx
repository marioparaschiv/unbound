import { Component, type ReactNode } from 'react';
import { createLogger } from '@unbound-app/logger';

type DialogBoundaryProps = {
	/** Runs once the children throw. */
	onError: () => void;
	children: ReactNode;
};

type DialogBoundaryState = { failed: boolean };

const logger = createLogger('Dialogs');

/** Renders a dialog host, or nothing once it throws, reporting the failure. */
class DialogBoundary extends Component<DialogBoundaryProps, DialogBoundaryState> {
	state: DialogBoundaryState = { failed: false };

	static getDerivedStateFromError(): DialogBoundaryState {
		return { failed: true };
	}

	componentDidCatch(error: Error) {
		logger.error('Failed to render the alert host, using system alerts:', error);
		this.props.onError();
	}

	render(): ReactNode {
		return this.state.failed ? null : this.props.children;
	}
}

export default DialogBoundary;
