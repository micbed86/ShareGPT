import { deflateRawSync } from "node:zlib";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distPath = join(projectRoot, "dist");
const manifest = JSON.parse(await readFile(join(projectRoot, "manifest.json"), "utf8"));
const outputPath = join(distPath, `sharegpt-export-v${manifest.version}.zip`);
const packageEntries = ["manifest.json", "README.md", "PRIVACY.md", "src"];

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const safeDate = date instanceof Date && !Number.isNaN(date.valueOf()) ? date : new Date();
  const year = Math.max(1980, safeDate.getFullYear());
  const time = (safeDate.getHours() << 11) | (safeDate.getMinutes() << 5) | Math.floor(safeDate.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((safeDate.getMonth() + 1) << 5) | safeDate.getDate();
  return { time, day };
}

async function collectFiles(entryPath) {
  const absolutePath = join(projectRoot, entryPath);
  const details = await stat(absolutePath);
  if (details.isFile()) return [{ absolutePath, archivePath: entryPath.replaceAll(sep, "/"), details }];

  const children = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
    const childPath = join(entryPath, child.name);
    files.push(...await collectFiles(childPath));
  }
  return files;
}

function localHeader(file, offset) {
  const name = Buffer.from(file.archivePath, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(file.time, 10);
  header.writeUInt16LE(file.day, 12);
  header.writeUInt32LE(file.crc, 14);
  header.writeUInt32LE(file.compressed.length, 18);
  header.writeUInt32LE(file.source.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return { bytes: Buffer.concat([header, name, file.compressed]), offset };
}

function centralHeader(file, offset) {
  const name = Buffer.from(file.archivePath, "utf8");
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(file.time, 12);
  header.writeUInt16LE(file.day, 14);
  header.writeUInt32LE(file.crc, 16);
  header.writeUInt32LE(file.compressed.length, 20);
  header.writeUInt32LE(file.source.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

const fileRecords = [];
for (const entry of packageEntries) fileRecords.push(...await collectFiles(entry));

const files = [];
for (const record of fileRecords) {
  const source = await readFile(record.absolutePath);
  const compressed = deflateRawSync(source, { level: 9 });
  const { time, day } = dosDateTime(record.details.mtime);
  files.push({ ...record, source, compressed, crc: crc32(source), time, day });
}

let localOffset = 0;
const localParts = [];
const centralParts = [];
for (const file of files) {
  const local = localHeader(file, localOffset);
  localParts.push(local.bytes);
  centralParts.push(centralHeader(file, localOffset));
  localOffset += local.bytes.length;
}

const centralDirectory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(localOffset, 16);
end.writeUInt16LE(0, 20);

await mkdir(distPath, { recursive: true });
await writeFile(outputPath, Buffer.concat([...localParts, centralDirectory, end]));
console.log(`Created ${outputPath} with ${files.length} files.`);
