const mongoose = require('mongoose');
const { Schema } = mongoose;

const playlistSchema = new Schema({
  owner:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:       { type: String, required: true },
  description: String,
  visibility:  { type: String, enum: ['private', 'unlisted', 'public'], default: 'private' },
  shareToken:  { type: String, unique: true, sparse: true },
  tracks:      [{ trackId: String, position: Number, addedAt: { type: Date, default: Date.now } }],
}, { timestamps: true });

module.exports = mongoose.model('Playlist', playlistSchema);