import { InternalToastOptions } from './toasts';


export interface LoggerStoreEntry {
	time: number;
	message: string;
	level: number;
}

export interface LoggerStoreState {
	logs: LoggerStoreEntry[];
	addLog(message: LoggerStoreEntry['message'], level: LoggerStoreEntry['level']): void;
}

export interface ToastStoreState {
	toasts: Record<PropertyKey, InternalToastOptions>;
	addToast(options: InternalToastOptions);
	updateToastWithOptions(id: Required<InternalToastOptions['id']>, options: Partial<InternalToastOptions>);
}