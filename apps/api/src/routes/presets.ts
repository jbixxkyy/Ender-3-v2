const defaultPreset = {
  colors: { background: '#0f172a', card: '#111827', accent: '#22d3ee', text: '#f8fafc' },
  spacing: { sm: 8, md: 12, lg: 20 },
  typography: { fontFamily: 'Inter, sans-serif' },
  components: { cardStyle: 'soft' },
  layout: { sidebar: 'simplyprint' }
};

const klipperPreset = {
  colors: { background: '#0b1020', card: '#1f2937', accent: '#f97316', text: '#f3f4f6' },
  spacing: { sm: 8, md: 14, lg: 20 },
  typography: { fontFamily: 'Inter, sans-serif' },
  components: { cardStyle: 'sharp' },
  layout: { sidebar: 'mainsail' }
};

export async function presetRoutes(fastify: any) {
  fastify.get('/presets', async () => {
    const count = await fastify.prisma.uiPreset.count();
    if (count === 0) {
      await fastify.prisma.uiPreset.createMany({
        data: [
          { key: 'simplyprint-style', name: 'SimplyPrint Style', isDefault: true, values: defaultPreset },
          { key: 'klipper-print-styler', name: 'Klipper Print Styler', isDefault: false, values: klipperPreset }
        ]
      });
    }
    return fastify.prisma.uiPreset.findMany({ orderBy: { createdAt: 'asc' } });
  });

  fastify.post('/presets/:key/activate', async (request: any) => {
    const key = request.params.key;
    await fastify.prisma.$transaction([
      fastify.prisma.uiPreset.updateMany({ data: { isDefault: false } }),
      fastify.prisma.uiPreset.update({ where: { key }, data: { isDefault: true } })
    ]);
    return { ok: true, key };
  });
}
