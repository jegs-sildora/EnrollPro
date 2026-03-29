import 'dotenv/config';

// Set process timezone to Manila
process.env.TZ = 'Asia/Manila';

import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT as number, '0.0.0.0', () => {
	console.log(`[Server] Running on http://192.168.254.106:${PORT}`);
});
