import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const errors = [];
if (manifest.manifest_version !== 3) errors.push("manifest_version must equal 3");
if (manifest.action || manifest.browser_action || manifest.page_action) {
  errors.push("The extension must not expose a toolbar popup or action menu");
}

const referencedFiles = [
  manifest.background && manifest.background.service_worker,
  "src/background-core.js",
  ...(manifest.content_scripts || []).flatMap((entry) => [...(entry.js || []), ...(entry.css || [])])
].filter(Boolean);

for (const file of referencedFiles) {
  try {
    await access(resolve(root, file), constants.R_OK);
  } catch (_error) {
    errors.push(`Missing manifest file: ${file}`);
  }
}

const sourceFiles = await Promise.all(referencedFiles.filter((file) => file.endsWith(".js")).map(async (file) => ({
  file,
  source: await readFile(resolve(root, file), "utf8")
})));
for (const { file, source } of sourceFiles) {
  if (/<script[^>]+src=["']https?:/i.test(source)) errors.push(`Remote script reference found in ${file}`);
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) errors.push(`Dynamic code execution found in ${file}`);
}

if (!manifest.host_permissions.includes("https://ship.page/*")) {
  errors.push("ship.page host permission is required for publication");
}
if (!(manifest.content_scripts || []).some((entry) => (entry.matches || []).includes("https://chatgpt.com/*"))) {
  errors.push("chatgpt.com content script match is required");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Manifest MV3 OK. Verified ${referencedFiles.length} referenced files.`);
}
