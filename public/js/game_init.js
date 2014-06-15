"use strict";

// shuff a deck
function shuffle (list) {
    // create an array with array indices and random numbers
    var indices = Array.apply(null, Array(list.length)).map(function(_,i) { return [i, Math.random()]; });
    // sort based on the random numbers
    indices.sort(function (a,b) {
        return a[1] - b[1];
    });

    var ret = new Array(list.length);
    for (var i = 0; i < list.length; i++) {
        ret[i] = list[indices[i][0]];
    }
    return ret;
}

/* create a new game object for numPlayers number of players */
function createNewGame(numPlayers) {
    // initilize the deck
    
    var deck = [];
    // the colors of the cards.  We create a card of each color
    // for each item in numStack.
    var colors = ['red','green','blue','black','yellow'];
    var numStack = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
    for (var i = 0; i < colors.length; i++) {
        var color = colors[i];
        deck = deck.concat(numStack.map(function (number) {
            return {color: color, number: number, impossible: []};
        }));
    }

    var game = {
        players: [],
        deck: shuffle(deck),
        discard: [ [],[],[],[],[],[] ],
        tableau: [ [],[],[],[],[],[] ],
        clueTokens: 8,
        maxClueTokens: 8,
        hearts: 3,
        currentPlayer: 0,
        lastAction: null
    };
   
    // populate each player's hand
    var handSize = numPlayers <= 3 ? 5 : 4;
    for (var i = 0; i < numPlayers; i++) {
        // generate random IDs for each player.  These can be replaced with their
        // true IDs later.
        game.players.push({
            name: (''+Math.random()).slice(2,5),
            id: (''+Math.random()).slice(2,5),
            hand: game.deck.splice(0,handSize)
        });
    }
    
    //add on cards that are blank to the end of the deck to deal with the final round.
    for (i = 0; i < 5; i++){
    	game.deck.unshift({color: 'blank', number: 'blank', impossible: []});
    }

    return game;
}

/* create a game object for testing purposes */
function createDummyGame (numPlayers) {
    var game = createNewGame(numPlayers);
    return game;
}
