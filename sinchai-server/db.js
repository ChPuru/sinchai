// Exp 5 - MongoDB connection through Mongoose
const mongoose = require('mongoose');
const config = require('./config');

async function connect(uri = config.mongoUri) {
  // fail in 5 s with a clear message instead of hanging when the MongoDB service is not running
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

const disconnect = () => mongoose.disconnect();

module.exports = { connect, disconnect, mongoose };
