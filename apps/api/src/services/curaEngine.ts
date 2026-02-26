import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { slicedDir, writeAndHashFile } from '../utils/fs.js';

interface SliceArgs {
  sourcePath: string;
  fileName: string;
  profileConfig: Record<string, unknown>;
  curaEnginePath: string;
}

export async function runMockSlice({ fileName }: SliceArgs) {
  const outputName = `${path.parse(fileName).name}-${Date.now()}.gcode`;
  const outputPath = path.join(slicedDir, outputName);
  const mock = `; PrintPilot mock gcode\n; generated=${new Date().toISOString()}\nG28\nM104 S200\nM140 S60\n`;
  const hashResult = await writeAndHashFile(outputPath, mock);
  return {
    outputName,
    outputPath,
    log: 'Mock slice completed. Set CURA_ENGINE_PATH for real slicing.',
    ...hashResult
  };
}

export async function runCuraEngineSlice(args: SliceArgs) {
  const outputName = `${path.parse(args.fileName).name}-${Date.now()}.gcode`;
  const outputPath = path.join(slicedDir, outputName);
  const cliArgs = ['slice', '-j', 'fdmprinter.def.json', '-l', args.sourcePath, '-o', outputPath];
  const processResult = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    const child = spawn(args.curaEnginePath, cliArgs, { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });

  if (processResult.code !== 0) {
    throw new Error(`CuraEngine failed: ${processResult.stderr || processResult.stdout}`);
  }

  const gcode = await readFile(outputPath);
  const hashResult = await writeAndHashFile(outputPath, gcode);

  return {
    outputName,
    outputPath,
    log: processResult.stderr || processResult.stdout,
    ...hashResult
  };
}
