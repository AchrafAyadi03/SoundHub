// src/config/db.js
const mongoose = require('mongoose');

module.exports = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connecté :', mongoose.connection.name);

  // Charger les modèles (adapte les chemins à ton projet)
 require('../models/User');
 require('../models/Playlist');
 require('../models/Post');
  // Crée les collections et les index tout de suite
  await mongoose.connection.syncIndexes();
  await Promise.all(
    Object.values(mongoose.models).map((m) => m.createCollection())
  );
  console.log('Collections :', Object.keys(mongoose.models));
};