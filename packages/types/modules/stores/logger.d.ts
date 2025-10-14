export interface LogEntry {
	time: number;
	message: string;
	level: number;
}


export interface LoggerStoreState {
	logs: LogEntry[];
	addLog(message: LogEntry['message'], level: LogEntry['level']): void;
}