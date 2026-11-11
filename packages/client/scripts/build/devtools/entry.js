import { version } from 'react-devtools-core/package.json';
// The loader runs this before Discord's bundle, so the hook is installed before React loads.
import backend from 'react-devtools-core/dist/backend.js';

backend.initialize();

// The client's debugger carries the backend's messages over its own socket to the DevTools app.
window.DevTools = {
	version,
	connectWithCustomMessagingProtocol: backend.connectWithCustomMessagingProtocol,
};
