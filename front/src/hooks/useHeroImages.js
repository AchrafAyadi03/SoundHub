import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getMedia } from '../services/coverService.js';

const imageDataCache = new Map();
const imageSubscribers = new Map();
const mediaRequests = new Map();
const detailRequests = new Map();
const artistImageCache = new Map();
const artistImageRequests = new Map();
const preloadedImages = new Map();

function preloadImage(url) {
  if (!url || preloadedImages.has(url) || typeof Image === 'undefined') return;
  const image = new Image();
  preloadedImages.set(url, image);
  image.src = url;
}

function loadArtistImage(artists) {
  const name = String(artists || '').split(';')[0].trim();
  if (!name) return Promise.resolve(null);
  if (artistImageCache.has(name)) return Promise.resolve(artistImageCache.get(name));
  if (artistImageRequests.has(name)) return artistImageRequests.get(name);

  const request = api.artistImage(name)
    .then((result) => {
      const url = typeof result?.image_url === 'string' ? result.image_url : null;
      artistImageCache.set(name, url);
      return url;
    })
    .catch(() => {
      artistImageCache.set(name, null);
      return null;
    })
    .finally(() => artistImageRequests.delete(name));
  artistImageRequests.set(name, request);
  return request;
}

function getImageEntry(id) {
  if (!imageDataCache.has(id)) {
    imageDataCache.set(id, {
      media: null,
      artistImage: null,
      mediaLoaded: false,
      artistLoaded: false,
      genre: null,
      detailsLoaded: false,
    });
  }
  return imageDataCache.get(id);
}

function publishImageData(id, updates) {
  const entry = { ...getImageEntry(id), ...updates };
  imageDataCache.set(id, entry);
  imageSubscribers.get(id)?.forEach((subscriber) => subscriber(entry));
}

function subscribeToImageData(song, subscriber) {
  const id = String(song?.song_id || song?.id || '');
  if (!id) return () => {};
  const subscribers = imageSubscribers.get(id) || new Set();
  subscribers.add(subscriber);
  imageSubscribers.set(id, subscribers);
  subscriber(getImageEntry(id));

  if (!getImageEntry(id).mediaLoaded && !mediaRequests.has(id)) {
    const request = getMedia(id)
      .catch(() => null)
      .then((media) => publishImageData(id, { media, mediaLoaded: true }))
      .finally(() => mediaRequests.delete(id));
    mediaRequests.set(id, request);
  }

  const artistName = String(song.artists || '').split(';')[0].trim();
  if (!getImageEntry(id).artistLoaded && !artistName) {
    publishImageData(id, { artistImage: null, artistLoaded: true });
  } else if (!getImageEntry(id).artistLoaded && artistName) {
    loadArtistImage(artistName).then((artistImage) => {
      publishImageData(id, { artistImage, artistLoaded: true });
    });
  }

  if (!getImageEntry(id).detailsLoaded && !detailRequests.has(id)) {
    if (song.track_genre) {
      publishImageData(id, { genre: song.track_genre, detailsLoaded: true });
    } else if (song.track_name) {
      const request = api.songs(song.track_name, 500)
        .then((result) => {
          const songs = Array.isArray(result) ? result : result?.songs || [];
          const matchingSong = songs.find((item) => item.song_id === id);
          publishImageData(id, { genre: matchingSong?.track_genre || null, detailsLoaded: true });
        })
        .catch(() => publishImageData(id, { genre: null, detailsLoaded: true }))
        .finally(() => detailRequests.delete(id));
      detailRequests.set(id, request);
    } else {
      publishImageData(id, { genre: null, detailsLoaded: true });
    }
  }

  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size) imageSubscribers.delete(id);
  };
}

export default function useHeroImages(slides, index) {
  const [images, setImages] = useState({});
  const current = slides[index];
  const next = slides.length > 1 ? slides[(index + 1) % slides.length] : null;

  useEffect(() => {
    let active = true;
    const unsubscribe = [current, next].filter(Boolean).map((song) => {
      const id = String(song.song_id || song.id || '');
      if (!id) return () => {};
      return subscribeToImageData(song, (data) => {
        if (!active) return;
        preloadImage(data.artistImage || data.media?.cover_url);
        setImages((value) => ({
          ...value,
          [id]: { ...data, loading: !data.mediaLoaded },
        }));
      });
    });

    return () => {
      active = false;
      unsubscribe.forEach((stop) => stop());
    };
  }, [current, next]);

  return images;
}
