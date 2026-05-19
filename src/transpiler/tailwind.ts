import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

export type TailwindMode =
  | { kind: 'none' }
  | { kind: 'cdn' }
  | { kind: 'cli'; cssText: string };

/**
 * Detects Tailwind usage in the user's project and returns the appropriate
 * mode for injecting styles into the preview.
 *
 * - 'none'  — no Tailwind detected
 * - 'cdn'   — tailwind.config found but tailwindcss not installed locally
 * - 'cli'   — tailwindcss installed locally; CSS generated via CLI
 */
export async function detectAndBuildTailwind(
  fileDir: string,
  entryFile: string,
  isReactNative = false,
): Promise<TailwindMode> {
  // React Native components use StyleSheet.create(), not CSS class names.
  // Tailwind is not applicable — skip detection entirely.
  if (isReactNative) { return { kind: 'none' }; }

  const projectRoot = findProjectRoot(fileDir);
  if (!projectRoot) { return { kind: 'none' }; }

  const hasConfig = hasTailwindConfig(projectRoot);
  const hasPackage = hasTailwindInPackageJson(projectRoot);

  if (!hasConfig && !hasPackage) { return { kind: 'none' }; }

  // Check if tailwindcss CLI is actually installed
  const twBin = findTailwindBin(projectRoot);
  if (!twBin) {
    // Config found but not installed — use CDN
    return { kind: 'cdn' };
  }

  // Run CLI to generate CSS from the entry file
  try {
    const cssText = await runTailwindCli(twBin, projectRoot, entryFile);
    return { kind: 'cli', cssText };
  } catch {
    // CLI failed — fall back to CDN
    return { kind: 'cdn' };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
];

function hasTailwindConfig(root: string): boolean {
  return CONFIG_FILES.some((f) => fs.existsSync(path.join(root, f)));
}

function hasTailwindInPackageJson(root: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return 'tailwindcss' in deps;
  } catch {
    return false;
  }
}

function findTailwindBin(root: string): string | null {
  // Local install takes priority
  const local = path.join(root, 'node_modules', '.bin', 'tailwindcss');
  if (fs.existsSync(local)) { return local; }
  const localExe = local + '.cmd'; // Windows
  if (fs.existsSync(localExe)) { return localExe; }
  return null;
}

/**
 * Walk up from fileDir to find the nearest package.json — that's the project root.
 */
function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) { return dir; }
    const parent = path.dirname(dir);
    if (parent === dir) { break; }
    dir = parent;
  }
  return null;
}

/**
 * Run `tailwindcss --input /dev/null --content <entry> --output -`
 * and return the generated CSS as a string.
 */
function runTailwindCli(bin: string, root: string, entryFile: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use stdin as empty input, scan the entry file for classes
    const args = [
      '--input', path.join(root, 'node_modules', 'tailwindcss', 'base.css').replace(/\\/g, '/'),
      '--content', entryFile,
      '--output', '-',
      '--minify',
    ];

    // Fall back to an inline @tailwind directives approach if base.css doesn't exist
    const proc = child_process.spawn(bin, args, {
      cwd: root,
      timeout: 10_000,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `tailwindcss exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}
