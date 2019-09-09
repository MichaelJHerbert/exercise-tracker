const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const UserSchema = new Schema({
  userId: Number,
  username: String
});

module.exports = User = mongoose.model('user', UserSchema);
