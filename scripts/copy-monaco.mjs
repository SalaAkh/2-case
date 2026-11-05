import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
const source = path.resolve("node_modules/monaco-editor/min/vs");
const target = path.resolve("public/monaco/vs");
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log("Monaco assets ready locally — no CDN required.");
