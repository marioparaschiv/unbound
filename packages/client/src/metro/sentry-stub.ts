import type { ComponentType, ErrorInfo, ReactNode } from 'react';
import noop from '@unbound-app/utils/noop';

/** A Sentry scope, client or integration whose every method does nothing. */
type Inert = Record<string, typeof noop | undefined>;

type FallbackProps = {
	error: Error;
	componentStack: string;
	eventId: string;
	resetError: () => void;
};

type ErrorBoundaryProps = {
	children?: ReactNode;
	fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
	onError?: (error: Error, componentStack: string, eventId: string) => void;
};

type ErrorBoundaryState = {
	error: Error | undefined;
};

// `then` stays `undefined` so an awaited stub does not look like a promise.
function createInert(): Inert {
	return new Proxy<Inert>(
		{},
		{
			get: (_, key) => (key === 'then' || typeof key === 'symbol' ? undefined : noop),
		},
	);
}

const identity = <T>(value: T) => value;
const resolved = (value: boolean) => () => Promise.resolve(value);
const passThrough = ({ children }: ErrorBoundaryProps) => children ?? null;

// Built on first use: `React` exists only after Discord's main module, later than this stub.
let ErrorBoundary: ComponentType<ErrorBoundaryProps> | undefined;

function createErrorBoundary(): ComponentType<ErrorBoundaryProps> {
	const React = globalThis.React;

	if (!React) {
		return passThrough;
	}

	ErrorBoundary = class SentryErrorBoundary extends (
		React.Component<ErrorBoundaryProps, ErrorBoundaryState>
	) {
		state: ErrorBoundaryState = { error: undefined };

		static getDerivedStateFromError(error: Error): ErrorBoundaryState {
			return { error: error ?? new Error('Unknown render error') };
		}

		componentDidCatch(error: Error, info: ErrorInfo) {
			this.props.onError?.(error, info.componentStack ?? '', '');
		}

		render() {
			const { error } = this.state;
			const { fallback, children } = this.props;

			if (!error) {
				return children ?? null;
			}

			if (typeof fallback === 'function') {
				return fallback({
					error,
					componentStack: '',
					eventId: '',
					resetError: () => this.setState({ error: undefined }),
				});
			}

			return fallback ?? null;
		}
	};

	return ErrorBoundary;
}

/**
 * @description Builds the exports that stand in for Discord's Sentry React Native SDK, so Sentry never starts.
 * Covers every export Discord's bundle reads; each does nothing.
 * @returns The stub's module exports.
 */
export function createSentryStub(): MetroExport {
	const scope = createInert();
	const integration = () => createInert();

	return {
		__esModule: true,
		init: noop,
		addBreadcrumb: noop,
		addEventProcessor: noop,
		captureException: () => '',
		captureMessage: () => '',
		captureEvent: () => '',
		getClient: noop,
		getCurrentScope: () => scope,
		getIsolationScope: () => scope,
		getGlobalScope: () => scope,
		setTag: noop,
		setTags: noop,
		setUser: noop,
		setExtra: noop,
		setExtras: noop,
		setContext: noop,
		withScope: (...args: ((scope: Inert) => void)[]) => args.at(-1)?.(scope),
		withProfiler: identity,
		wrap: identity,
		flush: resolved(true),
		close: resolved(true),
		crashedLastRun: resolved(false),
		nativeCrash: noop,
		featureFlagsIntegration: integration,
		reactNavigationIntegration: integration,
		reactNativeTracingIntegration: integration,
		get ErrorBoundary() {
			return ErrorBoundary ?? createErrorBoundary();
		},
	};
}
