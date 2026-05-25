// Recreates symlinks from apps/mobile/node_modules → workspace root node_modules
// for every dep declared in this package.json.
//
// Why this exists: npm workspaces hoists dependencies to the workspace root,
// but Expo Router builds bundle URLs as literal paths relative to the project
// root (e.g. ./node_modules/expo-router/entry). Those URLs 404 when the
// package only exists at the workspace root. Symlinks make the literal path
// resolve.

const fs = require("node:fs");
const path = require("node:path");

const here = __dirname;
const mobileRoot = path.resolve(here, "..");
const localModules = path.join(mobileRoot, "node_modules");
const workspaceRoot = path.resolve(mobileRoot, "..", "..");
const workspaceModules = path.join(workspaceRoot, "node_modules");

const pkg = JSON.parse(
  fs.readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
);
const deps = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
};

let linked = 0;
let skipped = 0;

for (const name of Object.keys(deps)) {
  // Skip workspace packages — npm already links those correctly.
  if (name === "@sona/shared") continue;

  const sourcePath = path.join(workspaceModules, name);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`[link-deps] missing in workspace: ${name}`);
    skipped++;
    continue;
  }

  const targetPath = path.join(localModules, name);
  const targetDir = path.dirname(targetPath);

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  // If a real directory is already in the way (npm put something here), leave it alone.
  // We only replace nothing-there OR an existing symlink.
  let existingStat;
  try {
    existingStat = fs.lstatSync(targetPath);
  } catch {
    existingStat = null;
  }
  if (existingStat && !existingStat.isSymbolicLink()) {
    skipped++;
    continue;
  }
  if (existingStat?.isSymbolicLink()) fs.unlinkSync(targetPath);

  // Use a relative symlink so the link survives if the repo is moved.
  const relSource = path.relative(targetDir, sourcePath);
  fs.symlinkSync(relSource, targetPath, "dir");
  linked++;
}

console.log(`[link-deps] linked ${linked}, skipped ${skipped}`);
