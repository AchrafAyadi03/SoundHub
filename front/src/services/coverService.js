const cache = new Map();
const inflight = new Map();
const queue = [];
let active = 0;
const LIMIT = 5;

function runNext() {
  if (active >= LIMIT) return;
  const task = queue.shift();
  if (!task) return;
  active += 1;
  task().finally(() => {
    active -= 1;
    runNext();
  });
}

export function getMedia(songId) {
  if (!songId) return Promise.resolve({ source: 'none', cover_url: null });
  if (cache.has(songId)) return Promise.resolve(cache.get(songId));
  if (inflight.has(songId)) return inflight.get(songId);

  const promise = new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const response = await fetch(`/api/media/${encodeURIComponent(songId)}`);
        if (!response.ok) throw new Error(`Erreur ${response.status}`);
        const media = await response.json();
        cache.set(songId, media);
        resolve(media);
      } catch (error) {
        reject(error);
      } finally {
        inflight.delete(songId);
      }
    });
  });
  inflight.set(songId, promise);
  runNext();
  return promise;
}
