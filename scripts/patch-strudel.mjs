import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function findKabelsalatPackages(root) {
  const found = [];
  async function walk(dir, depth = 0) {
    if (depth > 7) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (dir.endsWith(join("@kabelsalat", "web"))) {
      found.push(dir);
      return;
    }

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => entry.name !== ".bin")
        .map((entry) => walk(join(dir, entry.name), depth + 1)),
    );
  }

  await walk(root);
  return found;
}

const packages = await findKabelsalatPackages(join(process.cwd(), "node_modules"));
await Promise.all(
  packages.map(async (pkgDir) => {
    const pkgPath = join(pkgDir, "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    pkg.main = "dist/index.mjs";
    pkg.module = "dist/index.mjs";
    pkg.exports = {
      ".": "./dist/index.mjs",
    };
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`[patch-strudel] patched ${pkg.name}@${pkg.version}`);
  }),
);
