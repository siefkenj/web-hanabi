"use strict";
/* create a game object for testing purposes */

function createDummyGame (numPlayers) {
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

    // initilize the deck
    var deck = [];
    var colors = ['red','green','blue','black','yellow']
    var numStack = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
    for (var i = 0; i < colors.length; i++) {
            var color = colors[i];
            deck = deck.concat(numStack.map(function (number) {
                    return {color: color, number: number, knowNot: {}};
            }));
    }

    var game = {
        players: [],
        deck: shuffle(deck),
        discard: [],
        tableau: [[]],
        clueTokens: 5,
        maxClueTokens: 8,
        hearts: 3,
        currentPlayer: null,
        lastAction: null
    }

    // populate each player's hand
    var handSize = numPlayers <= 3 ? 5 : 4;
    for (var i = 0; i < numPlayers; i++) {
        game.players.push({
            name: (''+Math.random()).slice(2,5),
            id: (''+Math.random()).slice(2,5),
            hand: game.deck.splice(0,handSize)
        });
    }
    
    // put a few cards in the discard
    game.discard = game.deck.splice(0,3);

    return game;
}
