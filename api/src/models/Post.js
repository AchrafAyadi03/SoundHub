const mongoose = require('mongoose');
const { Schema } = mongoose;

const postSchema = new Schema({
  author:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:     { type: String, enum: ['text', 'playlist'], default: 'text' },
  content:  String,
  playlist: { type: Schema.Types.ObjectId, ref: 'Playlist' },
  likes:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    author:    { type: Schema.Types.ObjectId, ref: 'User' },
    content:   String,
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);