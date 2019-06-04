/* based on https://www.terlici.com/2015/04/03/mongodb-node-express.html
 and http://theholmesoffice.com/mongoose-connection-best-practice/
 for alternative see https://code.tutsplus.com/articles/an-introduction-to-mongoose-for-mongodb-and-nodejs--cms-29527
 */

const mongoose = require('mongoose');

var state = {
  db: null,
};

exports.connect = function(uri){
  if (state.db) return done();

  mongoose.connect(uri);
  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('connected', function callback () {
    console.log('connected to db...');
    state.db = db;
  });
};

exports.get = function() {
  return state.db;
};

exports.close = function() {
  if (state.db) {
    state.db.disconnect();
    console.log('connection to db closed...');
  }
};
