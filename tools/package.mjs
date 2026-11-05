// Assembles the offline kit in release/ from dist/. Windows only.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KIT_NAME = 'PhD Defense';
const RELEASE_DIR = 'release';
const ZIP_NAME = 'PhD-Defense.zip';
const LAUNCHER_DIR = 'tools/launcher';

const kitDir = join(RELEASE_DIR, KIT_NAME);
const windir = process.env.WINDIR ?? 'C:\\Windows';
const csc = join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const tar = join(windir, 'System32', 'tar.exe');

if (process.platform !== 'win32') throw new Error('The offline kit can only be built on Windows.');
if (!existsSync(csc)) throw new Error(`C# compiler not found at ${csc}`);
if (!existsSync('dist/index.html')) throw new Error('dist/ is missing. Run npm run build first.');

rmSync(RELEASE_DIR, { recursive: true, force: true });
mkdirSync(join(kitDir, 'launcher'), { recursive: true });

cpSync('dist', join(kitDir, 'app'), { recursive: true });
cpSync(join(LAUNCHER_DIR, 'Launcher.cs'), join(kitDir, 'launcher', 'Launcher.cs'));
for (const script of ['Start safe mode.bat', 'Start fallback.bat']) {
  cpSync(join(LAUNCHER_DIR, script), join(kitDir, script));
}

execFileSync(
  csc,
  ['/nologo', '/optimize+', '/target:exe', `/out:${join(kitDir, `${KIT_NAME}.exe`)}`, join(LAUNCHER_DIR, 'Launcher.cs')],
  { stdio: 'inherit' },
);

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', '--short', 'HEAD');
const dirty = git('status', '--porcelain') ? ' plus uncommitted changes' : '';
const built = new Date().toISOString().slice(0, 16).replace('T', ' ');

writeFileSync(
  join(kitDir, 'README.txt'),
  `PhD Defense offline kit
Built ${built} from commit ${commit}${dirty}

Start
  Double-click "PhD Defense.exe" and keep its window open while presenting.
  Press f in the deck for fullscreen.

If Windows says "Windows protected your PC"
  Click More info, then Run anyway.

If the exe is blocked
  Double-click "Start fallback.bat".

If the machine struggles
  Double-click "Start safe mode.bat".

Other browsers
  While the launcher runs, the deck is also at the address shown in its window.
`.replace(/\n/g, '\r\n'),
);

execFileSync(tar, ['-a', '-c', '-f', join(RELEASE_DIR, ZIP_NAME), '-C', RELEASE_DIR, KIT_NAME], {
  stdio: 'inherit',
});

console.log(`\nOffline kit ready: ${kitDir} and ${join(RELEASE_DIR, ZIP_NAME)}`);
