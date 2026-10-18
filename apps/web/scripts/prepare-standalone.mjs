// The standalone server doesn't include static assets; copy them next to server.js.
import { cpSync, existsSync } from "node:fs";

const target = ".next/standalone/apps/web";
cpSync(".next/static", `${target}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${target}/public`, { recursive: true });
console.log(`Static assets copied to ${target}`);
