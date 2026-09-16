// The control channel the harness uses to drive the app.
//
// Deep links cannot do this job. iOS 26 shows an "Open in Jinx?" confirmation for every
// custom-scheme open, including `xcrun simctl openurl`, and simctl has no way to tap it.
// Universal Links would need a domain, which this project does not have yet.
//
// So the harness serves the screen it wants on loopback and the app, in development
// only, polls for it. The simulator shares the host's network stack, so 127.0.0.1 here
// is 127.0.0.1 there. No dialog, no relaunch between screens, and the app confirms which
// screen it rendered through the pixel marker rather than a fixed sleep.

import { createServer } from 'node:http';

export const PARITY_PORT = Number(process.env.PARITY_PORT ?? 8790);

export async function startControlServer() {
  let current = { screen: null, params: {}, seq: 0 };

  const server = createServer((req, res) => {
    if (req.url?.startsWith('/current')) {
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      });
      res.end(JSON.stringify(current));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PARITY_PORT, '127.0.0.1', resolve);
  });

  return {
    port: PARITY_PORT,
    set(screen, params = {}) {
      current = { screen, params, seq: current.seq + 1 };
      return current.seq;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
