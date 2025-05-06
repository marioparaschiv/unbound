import type { LoggerStoreState } from '@typings/stores/logger';
import { create } from 'zustand';


const LoggerStore = create<LoggerStoreState>((set) => ({
	logs: [],
	addLog(message, level) {
		set(prev => ({
			logs: [
				...prev.logs.slice(-50),
				{
					time: Date.now(),
					level,
					message
				}
			]
		}));
	},
}));

export default LoggerStore;