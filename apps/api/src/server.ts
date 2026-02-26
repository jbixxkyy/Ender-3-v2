import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import prismaPlugin from './plugins/prisma.js';
import { presetRoutes } from './routes/presets.js';
import { printerRoutes } from './routes/printers.js';
import { sliceRoutes } from './routes/slice.js';
import { ensureDataDirs } from './utils/fs.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart);
await app.register(websocket);
await app.register(prismaPlugin);
await ensureDataDirs();

await app.register(async (instance) => {
  instance.get('/health', async () => ({ ok: true, app: 'PrintPilot API' }));
  await printerRoutes(instance);
  await sliceRoutes(instance);
  await presetRoutes(instance);

  instance.get('/ws/status', { websocket: true }, (connection) => {
    const interval = setInterval(async () => {
      const printers = await instance.prisma.printer.findMany({ take: 5 });
      connection.socket.send(JSON.stringify({ type: 'status-tick', printers: printers.length, at: new Date().toISOString() }));
    }, 3000);

    connection.on('close', () => clearInterval(interval));
  });
}, { prefix: '/api' });

const port = Number(process.env.PORT || 7128);
const host = process.env.HOST || '127.0.0.1';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
