export type PrinterState = 'ready' | 'printing' | 'paused' | 'error' | 'offline';

export interface PrinterInput {
  name: string;
  baseUrl: string;
  apiKey?: string;
}

export interface PrinterStatus {
  state: PrinterState;
  progress: number;
  extruderTemp: number;
  bedTemp: number;
  filename?: string;
}

export interface UiPreset {
  id: string;
  name: string;
  values: Record<string, unknown>;
}

export interface SliceRequest {
  printerId: string;
  profileId: string;
  materialPreset: string;
}
