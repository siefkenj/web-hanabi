'use strict';

// determines whether the cards in your hand are blank or shown.
var showCards = false;
var lobbyUrl = "/tests/lobby.html";
var game = null;

//decode the URI to get player information
function parseUriSearchString(str) {
    // Remove leading questionmark
    if (str.charAt(0) == '?') {
        str = str.slice(1);
    }

    // Split up strings in the form of "foo=bar&baz=bat" into
    // objects {foo: 'bar', baz: 'bat'}
    var ret = {}
    str.split('&').forEach(function (s) {
        var vals = s.split('=');
        ret[decodeURI(vals[0] || '')] = decodeURI(vals[1] || '');
    });
    return ret;
}

function extend(a, b) {
    var i;
    for (i in b) {
        a[i] = b[i];
    }
}

// take an object a and give it a key for
// every item in arr and set the corresponding key to
// true
function extendByArray(a, arr) {
    var i;
    for (i = 0; i < arr.length; i++) {
        a[arr[i]] = true;
    }
}

//add an event lister if none exists otherwise do nothing
function initializeListener(obj, type, callback, options) {
    if (options && options.override) {
        removeListener(obj, type)
    }
    if (!obj.hasAttribute('x-callback')) {
        obj.setAttribute('x-callback', 1);
        obj.addEventListener(type, callback);
        obj.listener = callback;
    }
}

//if an event lister exists remove it from the object
function removeListener(obj, type) {
    if (obj.hasAttribute('x-callback')) {
        obj.removeAttribute('x-callback');
        obj.removeEventListener(type, obj.listener);
        obj.listener = null;
    }
}

// returns a list of classes corresponding to
// what is known about this card
function getKnowledgeClasses(card) {
    var possibleKnowledge = ['red', 'green', 'blue', 'yellow', 'black', 1, 2, 3, 4, 5];
    var ret = [];
    for (var i = 0; i < possibleKnowledge.length; i++) {
        var possibility = possibleKnowledge[i];
        if (!card.impossible[possibility]) {
            ret.push("maybe-" + possibility);
        }
    }
    return ret;
}
// end the game shows the score and allows quick access to the lobby
function endGame(messageDiv, game) {
        messageDiv.innerHTML = "<p>End of Game! You got " + game.score + " points! </p><p>Click here to return to Lobby</p>"
        messageDiv.setAttribute('style', '');
        messageDiv.addEventListener('click', function (e) {
            lobbyUrl += window.location.search
            document.location.href = lobbyUrl;                     
        });
}

// records a move in the game log, also sets the game log to the move that is being logged. 
function logMove (game, name, instruction, numberColor, isPlayed, other) {
    if (other) {
        var s = name + " told " + other + " about their " + numberColor + "'s";
    } else {
        var type = instruction == "discard-card" ? "discard" : "card";
        if (type == "discard") {
            var s = name + ' ' + type + "ed a " + numberColor;
        } else {
            s = name + " tried to play a " + numberColor + " and was " 
            s += isPlayed ? "" : "not ";
            s += "successful";
        }
    }
    game.lastAction = s;
    game.gameLog.push(s);
    console.log(game.gameLog, "last action ", game.lastAction);
}

//updates all information based on the game object
function updateScreen(game, others, me, socket, currPlayerId, myId) {
    console.log(game.currentPlayer, "the final round is!!!!", game.finalRound, 'length of the deck', game.deck.length);
    var i;
    // clear the screen of all information
    var cardLists = document.querySelectorAll('.card-list');
    for (i = 0; i < cardLists.length; i++) {
        cardLists[i].innerHTML = "";
    }
    var messageDiv = document.querySelector('#messages');
    messageDiv.setAttribute('style', 'display: none;');
    messageDiv.innerHTML == '';

    // hide the buttons, the first one found will be the instructions to move around
    var knowledgeButtons = document.querySelector('.instruction');
    knowledgeButtons.setAttribute('style', 'display: none;');
    // setup all other player's hands
    for (i = 0; i < others.length; i++) {
        var handDiv = document.querySelector("#hand" + i + ' .card-list');
        setupHand(others[i].hand, handDiv, i);
    }
    // set up our own hand
    setupMyHand(me.hand, document.querySelector("#my-hand .card-list"), showCards);

    //set up hearts
    document.querySelector('#hearts-display').innerHTML = game.hearts;
    // set up clues
    document.querySelector('#clue-display').innerHTML = game.clueTokens;
    // set up deck
    document.querySelector('#deck-display').innerHTML = game.deck.length;

    // end the game if there are no hearts or if this is the final round of play
    if (game.hearts == 0 || game.finalRound == game.currentPlayer) {
        endGame(messageDiv, game);
        return;
    }

    //end the game after one more round if there are no more cards in the deck 
    // if the finalRound is not defined and there are no more cards set the final round
    if (!game.finalRound && game.deck.length == 0) {
        game.finalRound = game.currentPlayer + game.players.length;
messageDiv.innerHTML = "<p>This is the final round, Only one more Turn!</p>"
        messageDiv.setAttribute('style', '');
        messageDiv.addEventListener('click', function (e) {
            messageDiv.setAttribute('style', 'display: none;');
        });
    }
        
    // click listener for others' hands.  This pops up the
    // menu where you can choose what information to give
    var clickedOnOther = function (e) {
        if (e.originalTarget.className == "card") {
            var target = e.originalTarget;
            var playerNumber = target.getAttribute('x-player-number');
            var cardIndex = target.getAttribute('x-card-index');
            var cardColor = others[playerNumber].hand[cardIndex].color;
            var cardNumber = others[playerNumber].hand[cardIndex].number;

            // show the buttons
            e.currentTarget.appendChild(knowledgeButtons);
            knowledgeButtons.setAttribute('style', '');
            knowledgeButtons.setAttribute('x-color', cardColor);
            knowledgeButtons.setAttribute('x-number', cardNumber);
            knowledgeButtons.setAttribute('x-player-number', playerNumber);
        }
    }

    // attach the listener to everyones hands
    for (i = 0; i < others.length; i++) {
        var handDiv = document.querySelector("#hand" + i);
        initializeListener(handDiv, 'click', clickedOnOther);
    }

    // setup the instruction clicks for the information menu.
    var instructionClick = function (e) {
        var target = e.currentTarget;
        var instructionType = e.originalTarget.getAttribute('x-button');
        var playerNumber = target.getAttribute('x-player-number');
        var instructionColor = target.getAttribute('x-color');
        var instructionNumber = target.getAttribute('x-number');
        var instruction = instructionType == 'tell-color' ? instructionColor : instructionNumber;
        switch (instructionType) {
            case "cancel":
                knowledgeButtons.setAttribute('style', 'display: none;');
                break;
            case "tell-color":
            case "tell-number":
                if (game.clueTokens <= 0) {
                    return;
                }
                game.clueTokens--;
                setKnowledge(others[playerNumber].hand, instruction);
                logMove(game, me.name, instructionType, instruction, null, others[playerNumber].name); 
                game.currentPlayer++;
                socket.emit('game-update', game);
                break;
        }
    }
    initializeListener(knowledgeButtons, 'click', instructionClick, { override: true });

    //look for my hand buttons and hide them
    var myHandButtons = document.querySelector('#my-hand .instruction');
    myHandButtons.setAttribute('style', 'display: none;');
    var mydiv = document.querySelector("#my-hand");

    // setup listner for our hand
    var clickedMyHand = function (e) {
        if (e.originalTarget.className == "card") {
            var target = e.originalTarget;
            var cardIndex = target.getAttribute('x-card-index');
            myHandButtons.setAttribute('style', '');
            myHandButtons.setAttribute('x-card-index', cardIndex);
        }
    }
    initializeListener(mydiv, 'click', clickedMyHand, { override: true });

    //set up the discard and the tableau
    var discard = document.querySelector("#discard");
    var playfield = document.querySelector("#play-field");
    setupTableau(game, discard, playfield);


    var myHandClick = function (e) {
        var target = e.currentTarget;
        var instructionType = e.originalTarget.getAttribute('x-button');
        var cardIndex = target.getAttribute('x-card-index');
        myHandInstruction(game, target, instructionType, cardIndex, me, socket, myHandButtons);
    }

    initializeListener(myHandButtons, 'click', myHandClick, { override: true })
}

function setupTableau(game, discardArea, playfieldArea) {
    var i, j;

    // set up the discard area
    var s = "<ul>";
    for (i = 0; i < game.discard.length; i++) {
        var card = game.discard[i];
        s += "<li>";
        s += "<img class='card' src='/images/cards/" + card.number + "-" + card.color + ".png' />";
        s += "</li>";
    }
    s += "</ul>"
    discardArea.innerHTML = s;

    // set up the playfield
    var s = "<ul>";
    for (i in game.tableau) {
        var stack = game.tableau[i];
        s += "<li><ul class='card-stack'>";
        for (j = 0; j < stack.length; j++) {
            var card = stack[j];
            s += "<li>";
            s += "<img class='card' src='/images/cards/" + card.number + "-" + card.color + ".png' />";
            s += "</li>";
        }
        s += "</ul></li>";
    }
    s += "</ul>"
    playfieldArea.innerHTML = s;

}

// returns whether a card is playable in the current game
function isCardPlayable(game, card) {
    // checks if the length is undefined, if it is use 0 as the length.
    var length = game.tableau[card.color] ? game.tableau[card.color].length : 0;
    // if the card number is the length +1 then it is the right card to play otherwise it is invalid 
    if (card.number == length + 1) {
        return true;
    } else {
        return false;
    }
}

// runs when the instruction buttons in our hand are clickes can choose between playing, cancelling move and discarding a card.
function myHandInstruction(game, target, instructionType, cardIndex, me, socket, myHandButtons) {
    switch (instructionType) {
        case "cancel":
            myHandButtons.setAttribute('style', 'display: none;');
            return;
        case "play-card":
            var playedCard = me.hand.splice(cardIndex, 1)[0];
            var isPlayed = isCardPlayable(game, playedCard);
            if (isPlayed) {
                game.tableau[playedCard.color] = (game.tableau[playedCard.color] || []);
                game.tableau[playedCard.color].push(playedCard);
                game.score++;
                if (playedCard.number == 5) {
                    game.clueTokens = Math.min(game.clueTokens + 1, game.maxClueTokens);
                }
            } else {
                // put the played card on the discard pile
                game.discard.push(playedCard);
                game.hearts = game.hearts - 1;
            }
            break;
        case "discard-card":
            game.clueTokens = Math.min(game.clueTokens + 1, game.maxClueTokens);
            var playedCard = me.hand.splice(cardIndex, 1)[0];
            // put the played card on the discard pile
            game.discard.push(playedCard);
            break;
    }
    // add a new card to your hand if its not the end of game
    if (!game.finalRound) {
        me.hand.push(game.deck.pop());
    }
    logMove(game, me.name, instructionType, playedCard.color + ' ' + playedCard.number, isPlayed)
    game.currentPlayer++;
    socket.emit('game-update', game);

}

// setup my hand, can either show the cards or hide the cards
function setupMyHand(hand, parent, show) {
    var s = "";
    for (var i = 0; i < hand.length; i++) {
        var knowledge = getKnowledgeClasses(hand[i]).join(' ');
        s += "<li>";
        // put all the information we know about possibilities for the card in one place
        s += "<div class='knowledge " + knowledge + "'>";
        s += '<span class="color">■</span><span class="color">■</span><span class="color">■</span><span class="color">■</span><span class="color">■</span>';
        s += '<span class="number">1</span><span class="number">2</span><span class="number">3</span><span class="number">4</span><span class="number">5</span>';
        s += "</div>"
        //either show or hide the cards
        s += show ? "<img class='card' x-card-index='" + i + "' src='/images/cards/" + hand[i].number + "-" + hand[i].color + ".png'/>" : "<div class='card' x-card-index='" + i + "'></div>";
        s += "</li>";
    }
    parent.innerHTML = s;
}

function getPlayerById(gameTemp, id) {
    for (var i = 0; i < gameTemp.players.length; i++) {
        if (game.players[i].id == id) {
            return game.players[i];
        }
    }
}

// hand is the players hand, parent is the div
// that all the cards should be displayed in.
function setupHand(hand, parent, playerNumber) {
    var s = "<ul>";
    for (var i = 0; i < hand.length; i++) {
        var knowledge = getKnowledgeClasses(hand[i]).join(' ')
        s += "<li>";
        // put all the information we know about possibilities for the card in one place
        s += "<div class='knowledge " + knowledge + "'>";
        s += '<span class="color">■</span><span class="color">■</span><span class="color">■</span><span class="color">■</span><span class="color">■</span>';
        s += '<span class="number">1</span><span class="number">2</span><span class="number">3</span><span class="number">4</span><span class="number">5</span>';
        s += "</div>";
        s += "<img class='card' x-card-index='" + i + "' src='/images/cards/" + hand[i].number + "-" + hand[i].color + ".png' x-player-number='" + playerNumber + "'/>";
        s += "</li>";
    }
    parent.innerHTML = s;
}

function setKnowledge(hand, knowledge) {
    var allInfo = [];
    knowledge = '' + knowledge;
    var instructionType = null;

    // if knowledge lengh is 1 we assume it's a number
    if (knowledge.length == 1) {
        allInfo = [1, 2, 3, 4, 5];
        instructionType = 'number';
    } else {
        allInfo = ['red', 'green', 'blue', 'yellow', 'black'];
        instructionType = 'color';
    }
    var excludedInfo = allInfo.filter(function (x) {
        return x != knowledge;
    });
    for (var i = 0; i < hand.length; i++) {
        if (hand[i][instructionType] == knowledge) { // hand[i]['color']
            extendByArray(hand[i].impossible, excludedInfo);
        } else {
            hand[i].impossible[knowledge] = true;
        }
    }
}

window.onload = function () {
    // grab the name and room from the URI search string
    // get a few globals
    // some of these may be redundant
    var args = parseUriSearchString(window.location.search);
    var name = args.name;
    var id = args.persistentId;
    var room = args.room;
    var myId = id;
    var others = [];
    var me = null;
    var iAmCurrentPlayer = false;

    //if any of the necessary information is not there, kick them back to the lobby.
    if (!name || !id || !room) {
        document.location.href = lobbyUrl;
    }

    // Set up the web socket
    var socket = io.connect();
    window.ss = socket;

    socket.emit("set-name", name);
    socket.emit("set-room", room);
    // emitting this signal will trigger the initalize-game signal
    // and cause the server to send us a copy of the game object.
    socket.emit("start-game");


    //update the screen based on an incoming game object
    socket.on("update-data", function (gameTemp) {
        game = gameTemp;
        me = getPlayerById(game, myId);
        others = [];
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i].id != myId) {
                //others is now a list of the index of the player in the array of game.players
                others.push(game.players[i]);
            }
        }
        var currPlayerId = game.players[game.currentPlayer % game.players.length].id;
        updateScreen(game, others, me, socket, currPlayerId, myId);
    });

    // receive information from server about our name and id
    socket.on('id-info', function (data) {
        name = data.name;
        id = data.id;
    });
}
