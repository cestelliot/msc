/*jshint esversion: 6 */

/*
To do:
add database
add redis
*/

// --- NPM PACKAGES
const express = require('express'),
  url = require('url'),
  body_parser = require('body-parser'),
  ejs = require('ejs'),
  {makeCode} = require('./helper/codeString.js');

// --- INSTANTIATE APP, SERVER and SOCKET
const app = express();
const PORT = process.env.PORT || 5000;
var server = app.listen(PORT, function(){
    console.log("Listening on port %d", server.address().port);
    session.start_socketserver();
});
const io = require('socket.io')(server);

// --- APP PARAMETERS
app.locals.max_rooms = 3;
app.locals.max_per_room = 2;
app.locals.experiment_id = 'test-1';

// --- EXPORT TO CONTROLLERS
module.exports = {
  app: app,
  io: io
};
const session = require(__dirname+'/controllers/session.js')

// --- MONGOOSE SETUP
// db.connect(process.env.MONGODB_URI);

// --- STATIC MIDDLEWARE
app.use(express.static(__dirname + '/public'));

// --- BODY PARSING MIDDLEWARE
app.use(body_parser.json()); // to support JSON-encoded bodies

// --- LIBRARIES FOR EXPERIMENT SCRIPT
app.use('/jspsych', express.static(__dirname + "/jspsych"));
app.use('/libraries', express.static(__dirname + "/libraries"));
app.use('/helper', express.static(__dirname + "/helper"));

// --- VIEW LOCATION, SET UP SERVING STATIC HTML
app.engine('ejs', ejs.renderFile);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/public/views');

// --- ROUTING

app.get('/', (req, res, next) => {
    res.render('experiment.ejs');
});

app.get('/chat', (req, res, next) => {
    res.render('chat.ejs');
});

// --- SHUTDOWN
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Process terminated');
    // stop_webserver();
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Process terminated');
    // stop_webserver();
  });
});
