import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { runCuraEngineSlice, runMockSlice } from '../services/curaEngine.js';
import { uploadsDir } from '../utils/fs.js';

const sliceBodySchema = z.object({
  printerId: z.string(),
  profileId: z.string(),
  materialPreset: z.string().default('PLA')
});

export async function sliceRoutes(fastify: any) {
  fastify.get('/profiles', async () => {
    return fastify.prisma.curaProfile.findMany({ orderBy: { createdAt: 'desc' } });
  });

  fastify.post('/profiles/import', async (request: any, reply: any) => {
    const body = request.body as any;
    const profile = await fastify.prisma.curaProfile.create({
      data: {
        name: body?.name ?? `Imported ${new Date().toISOString()}`,
        sourceType: body?.sourceType ?? 'manual',
        config: body?.config ?? { layerHeight: 0.2, printTemp: 200 }
      }
    });
    return reply.code(201).send(profile);
  });

  fastify.post('/slice', async (request: any, reply: any) => {
    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let fileName = '';

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        fileName = part.filename;
        fileBuffer = await part.toBuffer();
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!fileBuffer || !fileName) {
      return reply.code(400).send({ error: 'File is required' });
    }

    const body = sliceBodySchema.parse(fields);
    await fastify.prisma.printer.findUniqueOrThrow({ where: { id: body.printerId } });
    const profile = await fastify.prisma.curaProfile.findUniqueOrThrow({ where: { id: body.profileId } });

    const sourcePath = path.join(uploadsDir, `${randomUUID()}-${fileName}`);
    await writeFile(sourcePath, fileBuffer);

    const useReal = process.env.CURA_ENGINE_PATH && process.env.CURA_ENGINE_PATH !== 'mock';
    const sliceResult = useReal
      ? await runCuraEngineSlice({
          sourcePath,
          fileName,
          profileConfig: profile.config as Record<string, unknown>,
          curaEnginePath: process.env.CURA_ENGINE_PATH as string
        })
      : await runMockSlice({
          sourcePath,
          fileName,
          profileConfig: profile.config as Record<string, unknown>,
          curaEnginePath: 'mock'
        });

    const slicedFile = await fastify.prisma.slicedFile.create({
      data: {
        name: sliceResult.outputName,
        filePath: sliceResult.outputPath,
        sizeBytes: sliceResult.sizeBytes,
        sha256: sliceResult.sha256,
        metadata: {
          sourceName: fileName,
          materialPreset: body.materialPreset
        }
      }
    });

    const sliceJob = await fastify.prisma.sliceJob.create({
      data: {
        printerId: body.printerId,
        profileId: body.profileId,
        slicedFileId: slicedFile.id,
        sourceName: fileName,
        materialPreset: body.materialPreset,
        status: 'completed',
        log: sliceResult.log
      }
    });

    return reply.code(201).send({ sliceJob, slicedFile, preview: { estimatedTime: 'n/a', filamentUsed: 'n/a' } });
  });

  fastify.get('/sliced-files', async () => {
    return fastify.prisma.slicedFile.findMany({ orderBy: { createdAt: 'desc' } });
  });

  fastify.post('/sliced-files/:id/send', async (request: any) => {
    const record = await fastify.prisma.slicedFile.findUniqueOrThrow({ where: { id: request.params.id } });
    return { ok: true, fileId: record.id, sent: true, autoStarted: false, note: 'File sent only after explicit confirmation.' };
  });

  fastify.post('/sliced-files/:id/start', async (request: any) => {
    const record = await fastify.prisma.slicedFile.findUniqueOrThrow({ where: { id: request.params.id } });
    return { ok: true, fileId: record.id, started: true, explicitConfirmation: true };
  });
}
