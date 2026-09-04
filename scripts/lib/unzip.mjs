import { inflateRawSync } from "node:zlib";

/**
 * Extracts one entry from a ZIP archive held in memory.
 *
 * Two of the public datasets this project regenerates from — the Census
 * Gazetteer and the USGS geographic names file — are only published as ZIPs,
 * and Node has no built-in reader. This handles the single shape they use:
 * a non-encrypted, non-ZIP64 archive whose entries are stored or deflated.
 *
 * @param {Buffer} buffer archive contents
 * @param {(name: string) => boolean} match picks the entry to extract
 * @returns {Buffer} the entry's uncompressed bytes
 */
export function extractZipEntry(buffer, match) {
  const directoryOffset = findCentralDirectory(buffer);

  let cursor = directoryOffset;
  while (cursor + 46 <= buffer.length && buffer.readUInt32LE(cursor) === 0x02014b50) {
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (match(name)) return readLocalEntry(buffer, localHeaderOffset, name);

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error("No matching entry was found in the archive.");
}

function findCentralDirectory(buffer) {
  // The end-of-central-directory record sits at the tail, after a comment of
  // unknown length, so it has to be scanned for backwards.
  const earliest = Math.max(0, buffer.length - 66_000);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return buffer.readUInt32LE(offset + 16);
  }
  throw new Error("Not a ZIP archive: no end-of-central-directory record.");
}

function readLocalEntry(buffer, offset, name) {
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error(`Corrupt local header for ${name}.`);

  const method = buffer.readUInt16LE(offset + 8);
  const compressedSize = buffer.readUInt32LE(offset + 18);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const body = buffer.subarray(start, start + compressedSize);

  if (method === 0) return body;
  if (method === 8) return inflateRawSync(body);
  throw new Error(`Unsupported compression method ${method} for ${name}.`);
}
