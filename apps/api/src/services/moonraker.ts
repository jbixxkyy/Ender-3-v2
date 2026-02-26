import type { Printer } from '@prisma/client';

export class MoonrakerClient {
  async healthCheck(printer: Printer) {
    try {
      const response = await fetch(`${printer.baseUrl}/printer/info`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as any;
      return { ok: true, version: payload?.result?.software_version ?? 'unknown' };
    } catch {
      return { ok: false, version: 'offline' };
    }
  }

  async getStatus(printer: Printer) {
    try {
      const response = await fetch(
        `${printer.baseUrl}/printer/objects/query?extruder=temperature,target&heater_bed=temperature,target&print_stats=state,filename,progress`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as any;
      const status = payload?.result?.status ?? {};
      return {
        state: status?.print_stats?.state?.toLowerCase() ?? 'ready',
        progress: Number(status?.print_stats?.progress ?? 0),
        extruderTemp: Number(status?.extruder?.temperature ?? 0),
        bedTemp: Number(status?.heater_bed?.temperature ?? 0),
        filename: status?.print_stats?.filename
      };
    } catch {
      return {
        state: 'offline',
        progress: 0,
        extruderTemp: 0,
        bedTemp: 0,
        filename: undefined
      };
    }
  }

  async listGcodeFiles(printer: Printer) {
    const response = await fetch(`${printer.baseUrl}/server/files/list?root=gcodes`);
    if (!response.ok) throw new Error(`Moonraker list failed with ${response.status}`);
    const payload = (await response.json()) as any;
    return payload?.result ?? [];
  }
}

export const moonrakerClient = new MoonrakerClient();
