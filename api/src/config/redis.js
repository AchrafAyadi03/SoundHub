
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
redis.on('connect', () => console.log('Redis connecté'));
redis.on('error', (err) => console.error('Erreur Redis:', err.message));

module.exports = redis;