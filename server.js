/*
 * Basic Node.js express server that runs a socket.io instance
 * to mirror all data sent by one client to all others (in the same
 * socket.io room)
 */

var PORT = 3000;

// Preliminaries
var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

// Statically server pages from the public directory
app.configure( function() {
    app.use(express.static(__dirname + '/public'));
});

// Start the server
server.listen(PORT);
console.log('Server listening on port ' + PORT);



// Handle all the websocket connections
io.sockets.on('connection', function(socket) {
    socket.on('disconnect', function () { console.log('Disconnecting Client'); });

    // rooms allow us to limit our broadcasts to others in the same room.
    socket.on('room', function(room) {
        console.log('Joining room', room);
        // leave any previous room we may have been in
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
        }
        socket.join(room)
        socket.currentRoom = room; 
    });

    // when new data is broadcast by a client, emit it to all
    // other clients in the same room
    socket.on('broadcast', function (data) {
        console.log('Got message to retransmit', data, socket.currentRoom);
        var room = socket.currentRoom;
        // everyone in the same room as the broadcaster will get the data
        // relayed to them
        socket.in(room).broadcast.emit('message', {message: data});
    });
});
