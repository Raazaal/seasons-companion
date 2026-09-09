import { writeFile, rename, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// Serializes saveState calls per filePath so concurrent saves for the same
// path never race on a shared temp filename. Each entry is the tail promise
// of the chain of pending saves for that path.
const saveQueues = new Map();

async function writeStateFile(filePath, state) {
  await mkdir(dirname(filePath), { recursive: true });
  // Unique per call so two in-flight saves for the same filePath never share
  // (and therefore never fight over) the same temp file.
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tmpPath, filePath);
}

export async function saveState(filePath, state) {
  const previous = saveQueues.get(filePath) ?? Promise.resolve();
  // Chain onto the previous save for this path regardless of whether it
  // succeeded or failed, so one rejected save doesn't wedge later saves.
  const current = previous.then(
    () => writeStateFile(filePath, state),
    () => writeStateFile(filePath, state)
  );
  saveQueues.set(filePath, current);
  try {
    await current;
  } finally {
    // Avoid unbounded growth of the map: drop the entry once this was the
    // last queued save for the path.
    if (saveQueues.get(filePath) === current) {
      saveQueues.delete(filePath);
    }
  }
}

export async function loadState(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}
