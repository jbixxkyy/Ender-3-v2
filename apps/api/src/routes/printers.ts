import { z } from 'zod';
import { moonrakerClient } from '../services/moonraker.js';

const createPrinterSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().optional()
});

export async function printerRoutes(fastify: any) {
  fastify.post('/printers', async (request: any, reply: any) => {
    const payload = createPrinterSchema.parse(request.body);
    const printer = await fastify.prisma.printer.create({ data: payload });
    return reply.code(201).send(printer);
  });

  fastify.get('/printers', async () => {
    return fastify.prisma.printer.findMany({ orderBy: { createdAt: 'desc' } });
  });

  fastify.get('/printers/:id/status', async (request: any) => {
    const printer = await fastify.prisma.printer.findUniqueOrThrow({ where: { id: request.params.id } });
    const [health, status] = await Promise.all([
      moonrakerClient.healthCheck(printer),
      moonrakerClient.getStatus(printer)
    ]);
    return { health, status };
  });

  fastify.post('/printers/:id/actions', async (request: any) => {
    const printer = await fastify.prisma.printer.findUniqueOrThrow({ where: { id: request.params.id } });
    const action = z.enum(['start', 'pause', 'resume', 'cancel']).parse(request.body?.action);
    return { ok: true, printerId: printer.id, action, note: 'Explicit action endpoint. Hook Moonraker command here.' };
  });
}
