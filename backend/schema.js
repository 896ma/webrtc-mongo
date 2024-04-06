// roomModel.js
const mongoose = require('mongoose');

// Define the schema for your room data
const roomSchema = new mongoose.Schema({
  roomID: String,
  users: [String], // Array of users' IDs
});

// Create a model based on the schema
const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
