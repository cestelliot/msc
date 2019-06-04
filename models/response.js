const mongoose = require( 'mongoose' );

const responseSchema = new mongoose.Schema({
  sessionId: String,
  trialId: String,
  studyName: String,
  date: { type: Date, default: Date.now },
  trialData: {},
  checked: {type: Boolean, default: false}
});


let Response = module.exports = mongoose.model('Response', responseSchema);
