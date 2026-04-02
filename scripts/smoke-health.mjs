import { spawn } from 'node:child_process';
import process from 'node:process';

const port = Number(process.env.SMOKE_PORT || '4173');
const host = '127.0.0.1';
const url = `http://${host}:${port}/health`;
const timeoutMs = 45_000;

const child = spawn('pnpm', ['dev', '--host', host, '--port', String(port)], {
	stdio: ['ignore', 'pipe', 'pipe'],
	env: process.env
});

child.stdout?.on('data', () => {});
child.stderr?.on('data', () => {});

function stopServer() {
	if (!child.killed) child.kill('SIGTERM');
}

async function waitForHealth() {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				const body = await response.json();
				if (body?.ok === true && body?.dbReady === true) {
					return body;
				}
			}
		} catch {
			// Keep polling until timeout.
		}
		await new Promise((resolve) => setTimeout(resolve, 800));
	}
	throw new Error(`Smoke health test failed or timed out after ${timeoutMs}ms at ${url}`);
}

let exitCode = 0;

try {
	const body = await waitForHealth();
	console.log('[smoke:health] ok', {
		schemaVersion: body.schemaVersion,
		expectedSchemaVersion: body.expectedSchemaVersion,
		state: body.state
	});
} catch (error) {
	exitCode = 1;
	console.error('[smoke:health] failed', error instanceof Error ? error.message : error);
} finally {
	stopServer();
}

process.exit(exitCode);
