#!/usr/bin/env bun
import { loadHistory } from './lib/history';
import { setupWebSocket } from './lib/ws';


await loadHistory();
await setupWebSocket();