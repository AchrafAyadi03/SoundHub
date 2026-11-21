const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  username:     { type: String, required: true, unique: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  avatarUrl:    String,
  bio:          String,
  role:         { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);