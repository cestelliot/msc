const uuid = require('uuid'),
      clone = require('clone'),
      {app} = require('../app'),
      {io} = require('../app');

/*
Terminology:
socket is the client, representing a particular participant
session is the room (simultaneous experiment instances), where pairs of participants can interact
*/
var sessions = [];
const READY_TIMEOUT = 3000;

exports.start_socketserver = function(){

  io.on('connection', function (socket) {

    socket.on('join', function(){
      var session = find_session(app.locals.experiment_id, app.locals.max_per_room, socket);
      socket.emit('join-reply', {session_id: session.id});
    });

    // disconnect is for automatic disconnects like closing the browser window
    socket.on('disconnect', function () {
      if(typeof socket.session !== 'undefined'){
        /* TODO:
          work out what should happen to someone if their partner is disconnected, and implement it
          in the session.update() function (which is called by session.leave() here)
          you may need to add an argument to the relevant functions if you want a different result from if
          the partner quits
        */
        socket.session.leave();

      }
    });

    // leave is for manual disconnects triggered by the client for whatever reason
    socket.on('leave', function(){
      if(typeof socket.session !== 'undefined'){
        /* TODO:
          work out what should happen to someone if their partner leaves, and implement it
          in the session.update() function (which is called by session.leave() here)
          you may need to add an argument to the relevant functions if you want a different result from if
          the partner is disconnected. Talk to me if you're not sure why the code below (in session.leave)
          might be inadequate
        */
        socket.session.leave();
      }
    });

    /*
      I'm commenting this out, because the client script doesn't yet have a function
      to emit that the participant is ready
    */
    // socket.on('ready-reply', function (data) {
    //   if(typeof socket.session !== 'undefined'){
    //     socket.session.client_ready(socket);
    //   }
    // });

    /*
      I don't know what the following is for
    */
    // socket.on('wait', function(){
    //   if(typeof socket.session == 'undefined'){
    //     return;
    //   }
    //   var wait = socket.session.messages.wait;
    //   if(!wait.includes(socket.id)){
    //     wait.push(socket.id);
    //     if(wait.length == socket.session.participants()){
    //       wait = [];
    //       io.to(socket.session.id).emit('wait-reply', {});
    //     }
    //   }
    // });

    /*
      I guess this is what handles turn taking? Why else would it be called that?
    */
    // socket.on('turn', function(data){
    //   if(typeof socket.session == 'undefined'){
    //     return;
    //   }
    //   var turn = socket.session.messages.turn;
    //   if(typeof turn[socket.player_id] == 'undefined'){
    //     turn[socket.player_id] = {player_id: socket.player_id, turn_data: data};
    //   }
    //   var done = true;
    //   for(var i=0; i<socket.session.participants(); i++){
    //     if(typeof turn[i] == 'undefined') { done = false; break; }
    //   }
    //   if(done){
    //     var td = clone(turn);
    //     turn = [];
    //     io.to(socket.session.id).emit('turn-reply', {data: td});
    //   }
    // });

    /*
      I think that this is for holding a list of messages/actions, until explicitly told
      to send them to everyone.
    */
    // socket.on('sync', function(data){
    //   if(typeof socket.session == 'undefined'){
    //     return;
    //   }
    //   var sync = socket.session.messages.sync;
    //   if(typeof sync[socket.player_id] == 'undefined'){
    //     sync[socket.player_id] = {player_id: socket.player_id, sync_data: data};
    //   }
    //   var done = true;
    //   for(var i=0; i<socket.session.participants(); i++){
    //     if(typeof sync[i] == 'undefined') { done = false; break; }
    //   }
    //   if(done){
    //     var random_index = Math.floor(Math.random()*socket.session.participants());
    //     var sync_message = clone(sync[random_index]);
    //     sync = [];
    //     io.to(socket.session.id).emit('sync-reply', sync_message);
    //   }
    // });

    /*
      I'm not 100% sure what this was **intended** to do,
      But for now, I'm just using it to handle message sending,
      ignoring the fact that something fancy is supposed to happen with session.messages below
    */
    socket.on('push', function(data){
      // the following is just a way to make nothing happen if the socket isn't assigned to a session
      if(typeof socket.session == 'undefined'){
        return;
      }
      data.id = socket.id;
      io.to(socket.session.id).emit('push-reply', data);
    });

    /*
      TODO: Don't worry about the following. I (Justin) will handle the saving of data...
    */
    // socket.on('write-data', function(data){
    //   if(typeof database !== 'undefined'){
    //     database.write(data);
    //   } else {
    //     console.log('Warning: no database connected');
    //   }
    // });
    //
    // socket.emit('connection-reply', {});

  });
};


function find_session(experiment_id, participants, client){
  var session;

  // first join sessions that are waiting for players
  for(var i=0; i<sessions.length; i++){
    if(sessions[i].join(experiment_id, participants, client)){
      session = sessions[i];
      break;
    }
  }
  // otherwise, create a new session and join it.
  if(typeof session == 'undefined'){
    session = create_session(experiment_id, participants);
    sessions.push(session);
    session.join(experiment_id, participants, client);
  }

  return session;
}

function create_session(experiment_id, total_participants){

  var session = {};
  session.id = uuid();
  session.experiment_id = experiment_id;
  session.total_participants = total_participants;
  session.started = false;

  session.messages = {
    turn: [],
    wait: [],
    sync: [],
    ready: 0
  };

  // returns the number of people in the session
  session.participants = function(){
    if(typeof io.sockets.adapter.rooms[this.id] == 'undefined'){
      return 0;
    } else {
      return io.sockets.adapter.rooms[this.id].length;
    }
  };

  // returns client ids in this session
  session.client_ids = function(){
    if(typeof io.sockets.adapter.rooms[this.id] == 'undefined'){
      return [];
    } else {
      return Object.keys(io.sockets.adapter.rooms[this.id].sockets);
    }
  };

  // adds client to this session if space is available and experiment_id matches
  session.join =  function(experiment_id, total_participants, client) {
    // check if experiment has already started or if session is full
    if(this.experiment_id !== experiment_id || total_participants !== this.total_participants || this.started || this.participants() >= this.total_participants) {
      return false;
    }
    client.join(this.id);
    client.session = this;

    this.update('joined');

    // when session is full, get confirmation from everyone that session can start
    if(this.participants() == this.total_participants){
      this.confirm_ready();
    }
    return true;
  };

  // called if someone leaves
  session.leave = function(client) {
    /* TODO: do something useful here
    */
    this.update('leave');
  };

  // called if someone disconnects
  session.disconnect = function(client) {
    // leaving the session is automatic when client disconnects,
    // TODO: do something useful here
    this.update('disconnect');
  };

  // updates each client with the number of currently connected participants
  session.update = function(message){
    /* TODO: this is from the code I copied. It's for sending a message to the entire room;
    currently doesn't have an endpoint in the client script, so if one person leaves,
    from their partner's viewpoint, it still looks like they're ready to go
    */
    var n_participants = this.participants();
    io.to(this.id).emit('session-update', {
      participants: n_participants,
      message: message
    });
  };

  session.confirm_ready = function() {
    // reset ready counter
    this.messages.ready = 0;
    // reset status of all clients
    var clients = io.in(this.id).connected;
    for(var id in clients){
      clients[id].confirmed_ready = false;
    }
    // send ready-check messages to all clients
    io.to(this.id).emit('ready-check', {});
    /* I'm commenting the following out for now. Ultimately, we want to get participants to confirm that they're ready,
    once their room is full, and have it boot them out of the particular room if they take too long,
    so that their partner is free to join up with another partner who is ready to go
    */
    // set timeout to abort ready process after Xms
    // setTimeout(()=>{
    //   this.abort_start();
    // }, READY_TIMEOUT);
  };

  /*
  TODO: I've commented the following few function out, cos they depend on participants having to confirm
  that they're ready, and that endpoint hasn't been implemented yet
  */
  // session.client_ready = function(client) {
  //   if(!client.confirmed_ready){
  //     this.messages.ready++;
  //     client.confirmed_ready = true;
  //     if(this.messages.ready == this.total_participants){
  //       this.start();
  //     }
  //   }
  // };

  // session.start = function(){
  //   this.started = true;
  //   var clients = io.in(this.id).connected;
  //   var idx = 0;
  //   for(var id in clients){
  //     clients[id].player_id = idx;
  //     idx++;
  //     clients[id].emit('start', {player_id: clients[id].player_id});
  //   }
  // };

  // session.abort_start = function(){
  //   // if session has started, there's no need for this abort.
  //   if(this.started){ return; }
  //   // ready-abort message alerts subjects that startup failed.
  //   io.to(this.id).emit('ready-abort');
  //   // check which clients failed to submit ready-reply
  //   // remove them from room so new clients can join
  //   var clients = io.in(this.id).connected;
  //   for(var id in clients){
  //     if(!clients[id].confirmed_ready){
  //       // send client a message that it was kicked out
  //       io.to(id).emit('kicked', {reason: 'ready-reply-fail'});
  //       // this removes the client from this room <socket.io>
  //       clients[id].leave(this.id);
  //       // this removes the client from this session
  //       session.leave();
  //     }
  //   }
  // };
  return session;
}

function destroy_session(id) {
  delete sessions[id];
}
