/*
 * Basic Node.js express server that runs a socket.io instance
 * to mirror all data sent by one client to all others (in the same
 * socket.io room)
 */


/*
 * Helper Functions
 */
function extend(a,b) {
    var k;
    for (k in b) {
        a[k] = b[k];
    }
    return a;
}



var PORT = 3000;

// Preliminaries
var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var game_init = require('./public/js/game_init');
io.set('log level', 1) // reduce the debug messages

// Statically server pages from the public directory
app.configure( function() {
    app.use(express.static(__dirname + '/public'));
});

// Start the server
server.listen(PORT);
console.log('Server listening on port ' + PORT);

// global data about the game for a room
var gamesList = {};

// Handle all the websocket connections
io.sockets.on('connection', function(socket) {
    // initialize the socket object to store some persistent data
    socket.hanabiData = {persistentId: socket.id};

    /*
     * Helper Functions
     */

    // return information on all clients in a particular room.
    //      roomList: list of all rooms on the server
    //      clientList: list of objects, each containing the name of
    //                  the client and a unique identifier for that
    //                  client (which can be used to identify yourself)
    function getRoomInfo (room) {
        var clientList = [];
        for (var i = 0, clients = io.sockets.clients(room); i < clients.length; i++) {
            clientList.push({name: clients[i].hanabiData.name, id: clients[i].id, data: clients[i].hanabiData});
        }

        var info = {
            roomList: Object.keys(io.sockets.manager.rooms),
            clients: clientList,
        };
        return info;
    }

    function informRoomOfChange (room) {
        if (room == null) {
            return;
        }
        // loop through all clients in this room and push them updated info
        // about th people in their room
        var info = getRoomInfo(room)
        for (var i = 0, clients = io.sockets.clients(room); i < clients.length; i++) {
            clients[i].emit('room-info', info);
        }

    }

    function isRoomReady(room){
        for (var i = 0, clients = io.sockets.clients(room); i < clients.length; i++) {
        if (!clients[i].hanabiData.readyState) {
            return false;
        }
        }
    return true;
    }
    


    /*
     * Event handlers
     */

    socket.on('disconnect', function () {
        console.log('Disconnecting Client', socket.hanabiData.currentRoom);
        // force ourselves to leave the room before the room
        // statistics get broadcast to the other people in the room!
        if (socket.hanabiData.currentRoom) {
            socket.leave(socket.hanabiData.currentRoom);
        }
        informRoomOfChange(socket.hanabiData.currentRoom);
    });

    // rooms allow us to limit our broadcasts to others in the same room.
    socket.on('set-room', function(room) {
        console.log('Joining room', room);
        // leave any previous room we may have been in
        if (socket.hanabiData.currentRoom) {
            socket.leave(socket.hanabiData.currentRoom);
        }
        socket.join(room);

        var oldRoom = socket.hanabiData.currentRoom;
        socket.hanabiData.currentRoom = room;
        // inform about our room change
        // to both the old room and the new room
        if (oldRoom) {
            informRoomOfChange(oldRoom);
        }
        if (oldRoom != room) {
            informRoomOfChange(room)
        }
    });
    socket.on('query-room', function (room) {
        console.log('Querying room', room);
        socket.emit('room-info', getRoomInfo(room));
    });
    socket.on('query-id', function () {
        socket.emit('id-info', {name: socket.hanabiData.name, id: socket.id, currentRoom: socket.hanabiData.currentRoom, persistentId: socket.hanabiData.persistentId});
    });
    socket.on('assert-id', function (data) {
        socket.hanabiData.persistentId = data.persistentId;
    });

    // set a new name for the client
    socket.on('set-name', function (name) {
        console.log('Setting name from', socket.hanabiData.name, ' to ', name);
        socket.hanabiData.name = name;
        informRoomOfChange(socket.hanabiData.currentRoom);
    });

    // set a new data for the client
    socket.on('set-data', function (data) {
        console.log('Setting data', data);
        extend(socket.hanabiData, data);
        var room = socket.hanabiData.currentRoom;
        informRoomOfChange(room);
        if(isRoomReady(room)){
            var newGame = game_init.createNewGame( getRoomInfo(room).clients.length);
            for (var i = 0, clients = io.sockets.clients(room); i < clients.length; i++) {
                newGame.players[i].id = clients[i].hanabiData.persistentId;
                newGame.players[i].name = clients[i].hanabiData.name; 
            }
            newGame.room = room;
            gamesList[room] =  newGame;
            socket.in(room).broadcast.emit('new-game', newGame);
            socket.emit('new-game', newGame);
        }
    });

    // when new data is broadcast by a client, emit it to all
    // other clients in the same room
    socket.on('broadcast', function (data) {
        console.log('Got message to retransmit', data, 'room: ', socket.hanabiData.currentRoom);
        var room = socket.hanabiData.currentRoom;
        // everyone in the same room as the broadcaster will get the data
        // relayed to them
        socket.in(room).broadcast.emit('message', {message: data, senderId: socket.id});
    });

    //sends the game object back on the request to start a new game.
    socket.on('start-game', function(){
        var room = socket.hanabiData.currentRoom;
        console.log("starting game in room", room);
        socket.emit('initialize-game', gamesList[room]);
    });

    socket.on('game-update', function(game){
       var room = socket.hanabiData.currentRoom;
       game.currentPlayer = game.currentPlayer + 1;
       gamesList[room] = game;
       console.log(gamesList[room].discard );
	   socket.in(room).broadcast.emit('update-data', gamesList[room]);
       
       socket.emit('update-data', gamesList[room]);      
    });
	    
});

	

