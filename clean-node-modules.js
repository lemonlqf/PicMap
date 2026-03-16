/*
 * @Author: Do not edit
 * @Date: 2026-03-04 11:23:42
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-04 11:41:22
 * @FilePath: \PicMap\clean-node-modules.js
 * @Description: 删除后端产物中的 devDependencies 依赖，减小体积
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, 'picMap_backend', 'package.json');
const nodeModulesPath = path.join(__dirname, 'dist', 'win-unpacked', 'resources', 'app', 'picMap_backend', 'node_modules');
const distLockPath = path.join(nodeModulesPath, '.package-lock.json');
const sourceLockPath = path.join(__dirname, 'picMap_backend', 'node_modules', '.package-lock.json');

if (!fs.existsSync(nodeModulesPath)) {
  console.log(nodeModulesPath, '目录不存在');
  process.exit(0);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const devDeps = new Set(Object.keys(packageJson.devDependencies || {}));

function parseTopLevelPackageName(lockPackagePath) {
  const parts = lockPackagePath.split('/');
  if (parts[0] !== 'node_modules') return null;

  // top-level scoped: node_modules/@scope/name
  if (parts[1]?.startsWith('@')) {
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : null;
  }

  // top-level unscoped: node_modules/name
  return parts.length === 2 ? parts[1] : null;
}

function loadDevPackagesFromLockfile(lockPath) {
  if (!fs.existsSync(lockPath)) return new Set();

  try {
    const lockJson = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    const packages = lockJson?.packages || {};
    const devPkgs = new Set();

    for (const [pkgPath, pkgMeta] of Object.entries(packages)) {
      if (!pkgMeta || pkgMeta.dev !== true) continue;

      const pkgName = parseTopLevelPackageName(pkgPath);
      if (pkgName) {
        devPkgs.add(pkgName);
      }
    }

    return devPkgs;
  } catch (error) {
    console.warn(`读取 lockfile 失败: ${lockPath}`, error.message);
    return new Set();
  }
}

const devDepsFromLock = fs.existsSync(distLockPath)
  ? loadDevPackagesFromLockfile(distLockPath)
  : loadDevPackagesFromLockfile(sourceLockPath);

const devPackagesToDelete = new Set([...devDeps, ...devDepsFromLock]);


const allDeps = new Set([
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {})
]);

const dirs = fs.readdirSync(nodeModulesPath);
let deletedCount = 0;
let keptCount = 0;

for (const dir of dirs) {
  const dirPath = path.join(nodeModulesPath, dir);

  if (!fs.statSync(dirPath).isDirectory()) {
    continue;
  }

  // Handle scoped packages (e.g. @scope/pkg)
  if (dir.startsWith('@')) {
    const scopePath = dirPath;
    const children = fs.readdirSync(scopePath);

    for (const child of children) {
      const childPath = path.join(scopePath, child);
      if (!fs.statSync(childPath).isDirectory()) continue;

      const fullName = `${dir}/${child}`; // e.g. @scope/name

      // If listed in devDependencies (either scoped name or unscoped), delete it
      if (devPackagesToDelete.has(fullName) || devPackagesToDelete.has(child)) {
        fs.rmSync(childPath, { recursive: true, force: true });
        deletedCount++;
        continue;
      }

      // otherwise keep
      keptCount++;
    }

    // If scope folder became empty, remove it
    const remaining = fs.existsSync(scopePath)
      ? fs.readdirSync(scopePath).filter(f => fs.statSync(path.join(scopePath, f)).isDirectory())
      : [];
    if (remaining.length === 0 && fs.existsSync(scopePath)) {
      try {
        fs.rmdirSync(scopePath);
      } catch (e) {
        // ignore
      }
    }

    continue;
  }

  // Non-scoped package: delete if it's listed in devDependencies
  if (devPackagesToDelete.has(dir)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    deletedCount++;
    continue;
  }

  // otherwise keep
  keptCount++;
}

console.log(`清理完成！`);
console.log(`识别到开发依赖目录: ${devPackagesToDelete.size} 个`);
console.log(`保留: ${keptCount} 个目录`);
console.log(`删除: ${deletedCount} 个目录`);
