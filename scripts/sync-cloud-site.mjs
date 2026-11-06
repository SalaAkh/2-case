import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "cloud-site");
// Preserve the maintained Sites scaffold and connector/runtime integrations.
// The Next.js MVP remains the canonical source for the application.
for (const directory of ["app", "components", "lib"]) {
  await cp(path.join(root, "src", directory), path.join(target, directory), { recursive: true });
}
await cp(path.join(root, "scripts/copy-monaco.mjs"), path.join(target, "scripts/copy-monaco.mjs"));
await cp(path.join(root, "public/presentation"), path.join(target, "public/presentation"), { recursive: true });
await cp(path.join(root, "public/presentation.html"), path.join(target, "public/presentation.html"));
const sourcePackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const hostingPackage = JSON.parse(await readFile(path.join(target, "package.json"), "utf8"));
for (const [name, version] of Object.entries(sourcePackage.dependencies)) {
  if (!["next", "react", "react-dom"].includes(name)) hostingPackage.dependencies[name] = version;
}
hostingPackage.name = "zero-spoiler-cloud-site";
hostingPackage.scripts.postinstall = "node scripts/copy-monaco.mjs";
await writeFile(path.join(target, "package.json"), JSON.stringify(hostingPackage, null, 2) + "\n");
console.log("Application source synchronized to the supported Sites adapter.");
