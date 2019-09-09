const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const ExerciseSchema = new Schema({
  userId: Number,
  description: String,
  duration: Number,
  date: Date
});

module.exports = Exercise = mongoose.model('exercise', ExerciseSchema);
