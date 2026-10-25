// DEV/TEST ONLY (never imported by deployed functions): runs the official Netlify Blobs local server
// (@netlify/blobs/server, the sandbox `netlify dev` uses) on a random localhost port, backed by a folder
// on disk, and points @netlify/blobs at it.
//
// Two shims make the local server behave like production Netlify Blobs, where conditional writes are
// atomic and ETags change on every write:
//  1. writes/deletes to the same key are serialized (the stock local server checks If-Match / If-None-Match
//     and then writes, non-atomically, so concurrent writers can both "win");
//  2. reads return an ETag header (the stock local server omits it, so conditional updates could not work);
//  3. ETags are a hash of the stored bytes (the stock server hashes the file mtime, which can repeat
//     within one millisecond and let a stale writer through). Every sealed write has a random IV, so
//     content hashes never repeat.
import { BlobsServer } from '@netlify/blobs/server';
import { setEnvironmentContext } from '@netlify/blobs';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const locks = new Map();
const serialize = (key, fn) => { const prev = locks.get(key) || Promise.resolve(); const run = prev.then(fn, fn); locks.set(key, run.catch(() => {})); return run; };
const keyOf = (req) => new URL(req.url, 'http://local').pathname;
let patched = false;
function patch() {
  if (patched) return; patched = true;
  const { put, delete: del, get } = BlobsServer.prototype;
  BlobsServer.prototype.get = async function (req) {
    const res = await get.call(this, req);
    if (res.status !== 200 || res.headers.get('etag') || res.headers.get('content-type')?.includes('json')) return res;
    const buf = Buffer.from(await res.arrayBuffer()); const headers = new Headers(res.headers);
    headers.set('etag', `"${createHash('sha256').update(buf).digest('hex')}"`);
    return new Response(buf, { status: 200, headers });
  };
  BlobsServer.prototype.put = function (req) { return serialize(keyOf(req), () => put.call(this, req)); };
  BlobsServer.prototype.delete = function (req) { return serialize(keyOf(req), () => del.call(this, req)); };
  BlobsServer.generateETag = async (p) => { try { return `"${createHash('sha256').update(await readFile(p)).digest('hex')}"`; } catch { return ''; } };
}

let started;
export function startLocalBlobs(directory) {
  return (started ||= (async () => {
    patch();
    const token = randomBytes(16).toString('hex');
    const server = new BlobsServer({ directory, token });
    const { port } = await server.start();
    const url = `http://localhost:${port}`;
    setEnvironmentContext({ siteID: 'local-ncdrh', token, edgeURL: url, uncachedEdgeURL: url });
    return { server, port, directory };
  })());
}
