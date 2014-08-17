"use strict"

var lobbyUrl = "/tests/lobby.html";
var game = null;

function parseUriSearchString (str) {
	// Remove leading questionmark
	if (str.charAt(0) == '?') {
		str = str.slice(1);
	}

	// Split up strings in the form of "foo=bar&baz=bat" into
	// objects {foo: 'bar', baz: 'bat'}
	var ret = {}
	str.split('&').forEach(function(s){
		var vals = s.split('=');
		ret[decodeURI(vals[0] || '')] = decodeURI(vals[1] || '')
	});
	return ret;
}

function extend (a,b) {
    var i;
    for (i in b) {
        a[i] = b[i];
    }
}
// take an object a and give it a key for
// every item in arr and set the corresponding key to
// true
function extendByArray (a, arr) {
    var i;
    for (i=0; i < arr.length; i++) {
        a[arr[i]] = true;
    }
}

//add an even lister if none exists otherwise do nothing
function initializeListener(obj, type, callback) {
    if (!obj.hasAttribute('x-callback')) {
        obj.setAttribute('x-callback', obj.addEventListener(type, callback))
    }
}

// returns a list of classes corresponding to
// what is known about this card
function getKnowledgeClasses(card) {
	var possibleKnowledge = ['red','green','blue','yellow','black',1,2,3,4,5];
	var ret = [];
	for (var i = 0; i < possibleKnowledge.length; i++) {
		var possibility = possibleKnowledge[i];
        if (!card.impossible[possibility]) {
			ret.push("maybe-" + possibility);
		}
	}
	return ret;
}

function updateScreen(game, others, me, socket){
    //clear the hands 
    var cardLists = document.querySelectorAll('.card-list');
    for(var i = 0; i < cardLists.length; i++){
        cardLists[i].innerHTML = "";
    }
    // hide the buttons
    var knowledgeButtons = document.querySelector('.instruction');
    knowledgeButtons.setAttribute('style', 'display: none;');
    // setup all other player's hands
    for(var i = 0; i < others.length; i++){
        var handDiv = document.querySelector("#hand" + i + ' .card-list');
        setupHand(others[i].hand, handDiv, i); 
    }
    // set up our own hand
    setupMyHand(me.hand,document.querySelector("#my-hand .card-list"));

    //set up hearts
    document.querySelector('#hearts-display').innerHTML = game.hearts
    // set up clues
    document.querySelector('#clue-display').innerHTML = game.clueTokens
    // set up deck 
    document.querySelector('#deck-display').innerHTML = game.deck.length - 5 // XXX fix this hack

    //add click listener to others' hands
    var clickedOnOther = function(e) {
        if (e.originalTarget.className == "card") {
            var target = e.originalTarget;
            var playerNumber = target.getAttribute('x-player-number');
            var cardIndex = target.getAttribute('x-card-index');
            var cardColor = others[playerNumber].hand[cardIndex].color
            var cardNumber =others[playerNumber].hand[cardIndex].number
            // show the buttons
            e.currentTarget.appendChild(knowledgeButtons);
            knowledgeButtons.setAttribute('style', '');
            knowledgeButtons.setAttribute('x-color', cardColor);
            knowledgeButtons.setAttribute('x-number', cardNumber);
            knowledgeButtons.setAttribute('x-player-number', playerNumber)
        }
    }
    for(var i = 0; i < others.length; i++){
        var handDiv = document.querySelector("#hand" + i);
        initializeListener(handDiv, 'click', clickedOnOther);
    }

    var instructionClick = function (e){
        var target = e.currentTarget;
        var instructionType = e.originalTarget.getAttribute('x-button')
        var playerNumber = target.getAttribute('x-player-number')
        var instructionColor =  target.getAttribute('x-color')
        var instructionNumber =  target.getAttribute('x-number')
        var instruction = instructionType == 'tell-color' ? instructionColor : instructionNumber;
        switch(instructionType){
            case "cancel":
                knowledgeButtons.setAttribute('style', 'display: none;'); 
                break;
            case "tell-color":
            case "tell-number":
                if (game.clueTokens <= 0) {
                    return;
                }
                game.clueTokens--;
                setKnowledge(others[playerNumber].hand, instruction)
		        socket.emit('game-update', game);
                break;
                
        }
    }
    initializeListener(knowledgeButtons, 'click', instructionClick);
}

function setupMyHand(hand, parent) {
    var s = "";
    for (var i = 0; i < hand.length; i++) {
        var knowledge = getKnowledgeClasses(hand[i]).join(' ')
        s += "<li>";
        // put all the information we know about possibilities for the card in one place
        s += "<div class='knowledge " + knowledge + "'>";
        s += '<span class="color">■</span><span class="color">■</span><span class="color">■</span><span class="color">■</span><span class="color">■</span>';
		s += '<span class="number">1</span><span class="number">2</span><span class="number">3</span><span class="number">4</span><span class="number">5</span>';
        s += "</div>";
        s += "<div class='card' x-card-index='" + i + "'></div>";
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
    var instructionType = null
    // if knowledge lengh is 1 we assume it's a number
    if (knowledge.length == 1) {
        allInfo = [1,2,3,4,5]
        instructionType = 'number'
    } else {
        allInfo = ['red','green','blue','yellow','black'];
        instructionType = 'color'
    }
    var excludedInfo = allInfo.filter(function(x) { return x != knowledge });
    for (var i=0; i < hand.length; i++){
        if(hand[i][instructionType] == knowledge){         // hand[i]['color']
            extendByArray(hand[i].impossible, excludedInfo);
        }
        else{
            hand[i].impossible[knowledge] = true;
        }
    }

}
window.onload = function() {
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
    if(!name||!id||!room){
        document.location.href = lobbyUrl;
    }

    // Set up the web socket
    var socket = io.connect();
    window.ss = socket;
   
    socket.emit("set-name", name);
    socket.emit("set-room", room); 
    //go get the game object
    socket.emit("start-game");
   
    //update the screen based on an incoming game object 
    socket.on('update-data', function(gameTemp){
        game = gameTemp;
        me = getPlayerById(game, myId);
        others = [];
        for (var i = 0; i < game.players.length; i++) {
	    	if (game.players[i].id != myId) {
                //others is now a list of the index of the player in the array of game.players
		    	others.push(game.players[i]);
		    }
	    }
        updateScreen(game,others, me, socket);
    });
    
    // recieve information from server about our name and id
	socket.on('id-info', function(data) {
		name = data.name;
		id = data.id;
	});

	function setKnowledgeColor(event){
		var target = event.currentTarget;
		var player = game.players[target.title];
		var info = target.innerHTML.substring(5);
		for (var i = 0; i < player.hand.length;i++){
			if(player.hand[i].color != info){
				player.hand[i].impossible.push(info);
			}else{
				var possibleKnowledge = ['red','green','blue','yellow','black'];
				for(var j = 0; j < possibleKnowledge.length; j++){
					if (info != possibleKnowledge[j] && player.hand[i].impossible.indexOf(info) == -1){
						player.hand[i].impossible.push(possibleKnowledge[j]);
					}
				}
			}
		}
		game.clueTokens = Math.max(game.clueTokens - 1, 0);
       	clearInstructions();
		broadcastNewGameState();
	}
    return;

    function broadcastNewGameState() {
		socket.emit('game-update', game);
	}
	
	/*These are the player actions, clicking on a cards activates either the
	  clue action or the play card action*/

	//if a card in another players hand is clicked then the option to give clues comes up
	function clue(event){
		var target = event.currentTarget;
		var cardname = (target.src.replace(/^.*[\\\/]/, '')).replace(/.png/, '');
		var cardNumber = cardname.substring(0,1)	
		var cardColor = cardname.substring(2);
		var s = "";
        if(game.clueTokens == 0){
            s += "<ul><li class='noClues'>No Clues!</li>";
        }else{
            s += "<ul><li class='tellColor' title="+ target.title + ">Tell " + cardColor + "</li>";
            s += "<li class='tellNumber' title=" + target.title + ">Tell " + cardNumber + "</li>";
        }
        s += "<li class= 'cancel'>Cancel</li><ul>";
		document.querySelector('#instruction').innerHTML = s;
        if(document.querySelector('.tellColor')){
            document.querySelector('.tellColor').style.background = cardColor;
        }
		addInstructionListner();
	}

	function setKnowledgeColor(event){
		var target = event.currentTarget;
		var player = game.players[target.title];
		var info = target.innerHTML.substring(5);
		for (var i = 0; i < player.hand.length;i++){
			if(player.hand[i].color != info){
				player.hand[i].impossible.push(info);
			}else{
				var possibleKnowledge = ['red','green','blue','yellow','black'];
				for(var j = 0; j < possibleKnowledge.length; j++){
					if (info != possibleKnowledge[j] && player.hand[i].impossible.indexOf(info) == -1){
						player.hand[i].impossible.push(possibleKnowledge[j]);
					}
				}
			}
		}
		game.clueTokens = Math.max(game.clueTokens - 1, 0);
       	clearInstructions();
		broadcastNewGameState();
	}

	function setKnowledgeNumber(event){
		var target = event.currentTarget;
		var player = game.players[target.title];
		var info = target.innerHTML.substring(5);
		for (var i = 0; i < player.hand.length;i++){
			if(player.hand[i].number != info){
				player.hand[i].impossible.push(info);
			}else{
				var possibleKnowledge = ['1','2','3','4','5'];
				for(var j = 0; j < possibleKnowledge.length; j++){
					if (info != possibleKnowledge[j] && player.hand[i].impossible.indexOf(info) == -1){
						player.hand[i].impossible.push(possibleKnowledge[j]);
					}
				}
			}
		}
		game.clueTokens = Math.max(game.clueTokens - 1, 0);
		broadcastNewGameState();
		clearInstructions();
	}

	//When a card in your hand is clicked it draws the discard and play options to the screen
	function myHandAction(event){
		var target = event.currentTarget.title;
		var s = "";
		s += "<ul><li class='playCard' title =" + target + ">Play Card</li>";
		s += "<li class='discardCard' title =" + target + ">Discard Card</li>";
		s += "<li class= 'cancel'>Cancel</li><ul>";

		var instructions = document.querySelector('#instruction')
		instructions.innerHTML = s;
		addInstructionListner();		
	}

	// plays the selected card
	function play(event){
		var cardNumber = event.currentTarget.title;
		var playedCard = me.hand.splice(cardNumber, 1)[0];	
		var cardNum = game.tableau[sortColor(playedCard.color)].length;
		if(playedCard.number == cardNum + 1){
			addSort(playedCard, game.tableau);
			if(playedCard.number == 5){
				game.clueTokens = Math.min(game.clueTokens + 1, game.maxClueTokens)
			}
		}else{
			if(game.hearts > 0) game.hearts--;
			addSort(playedCard, game.discard);
		}
		me.hand.push(game.deck.pop());
		broadcastNewGameState()
		clearInstructions();
	}

	//discard from the hand, checks if there are any cards left in the hand before running
	function Discard(event){
		if(me.hand.length != 0){
			var cardNumber = event.currentTarget.title;
			addSort(me.hand.splice(cardNumber, 1)[0], game.discard);
			me.hand.push(game.deck.pop());
			game.clueTokens = Math.min(game.clueTokens + 1, game.maxClueTokens)
			broadcastNewGameState()
			clearInstructions();
		}
	}

	function addInstructionListner(){
		if (document.querySelector('.tellNumber'))
			document.querySelector('.tellNumber').addEventListener('click',  setKnowledgeNumber);
		if (document.querySelector('.tellColor'))
			document.querySelector('.tellColor').addEventListener('click', setKnowledgeColor);
		if(document.querySelector('.discardCard'))
			document.querySelector('.discardCard').addEventListener('click', Discard);
		if (document.querySelector('.playCard'))
			document.querySelector('.playCard').addEventListener('click', play);
		if (document.querySelector('.noClues'))
			document.querySelector('.noClues').addEventListener('click', clearInstructions);
        if (document.querySelector('.cancel'))
			document.querySelector('.cancel').addEventListener('click', clearInstructions);
	}

	function clearInstructions(){
		var s = '';
		document.querySelector('#instruction').innerHTML = s;
	}


	//enumerate sorting sorting {[red], [green], [blue], [yellow], [black]
	//could be probably be an enumeration if that is supported...
	function sortColor(color){
		if (color == 'red')
			return 0;
		if (color == 'green')
			return 1;
		if (color == 'blue')
			return 2
		if (color == 'yellow')
			return 3
		if (color == 'black')
			return 4;
		// if we include a rainbow color
		else
			return 5;
			
	}

	//sorts in order into arrays by their color
	//assumes the sort destination is already set up to be sorted
	// in our case it can only be used on tableau and discard
	function addSort(card, sortdestination){
		//insert into the appropriate part of the array
		var toSort = sortdestination[sortColor(card.color)];
		toSort.push(card);
		var swapped;
		do {
			swapped = false;
			for (var i=0; i < toSort.length-1; i++) {
			    if (toSort[i].number > toSort[i+1].number) {
				var temp = toSort[i];
				toSort[i] = toSort[i+1];
				toSort[i+1] = temp;
				swapped = true;
			    }
		}
	    } while (swapped);
	}


	// generates the discard pile and the tableau
	function setupCards(hand, parent) {
		var s = "<ul>";
		if(hand){
			for (var i = 0; i < hand.length; i++) {
				if(hand[i][0]){
					s += "<div class =" + hand[i][0].color +"><ul>";
					for (var j = 0; j < hand[i].length; j++){
					
						s += "<li><img class='card' src='/images/cards/" + hand[i][j].number + "-" + hand[i][j]	.color + ".png' />";
						s += "</li>";
					}
					s+= "</ul></div>";
				}
			}
		}
		s += "</ul>";
		parent.innerHTML = s;

	}

	// hand is the players hand, parent is the div
	// that all the cards should be displayed in

	// might be a better way to do this without using the title as the position but I couldnt see it


	//updates all data on the screen others variable is global and should be defined properly before project is done
	function updateScreen2(game){
		var currPlayerId = game.players[game.currentPlayer % game.players.length].id;
		iAmCurrentPlayer = (currPlayerId == myId);
		//setup your hand
		setupMyHand(me.hand, document.querySelector('#myHand .handContents'));
		// set up the other player's hands
		for (var i = 0; i < others.length; i++) {
			var other = game.players[others[i]];
			document.querySelector('#other' + others[i] + ' .playerName').textContent = other.name;
			setupHand(other.hand, document.querySelector('#other' + others[i] + ' .handContents'), others[i]);
			if (other.id == currPlayerId) {
				document.querySelector('#other' + others[i]).setAttribute('style', 'background: orange')
			} else {
				document.querySelector('#other' + others[i]).setAttribute('style', '')
			}
		}
		if(currPlayerId == myId){
			document.querySelector('#myHand').setAttribute('style', 'background: orange');
		}else{
			document.querySelector('#myHand').setAttribute('style', '');
		}

		// display the heart tokens
		document.querySelector('.heartsDisplay').innerHTML = game.hearts;
		// display the clue tokens
		document.querySelector('.cluesDisplay').innerHTML = game.clueTokens;
		// display the discard hand
		document.querySelector('.deckDisplay').innerHTML = game.deck.length;
		setupCards(game.discard,  document.querySelector('#discard'));
		setupCards(game.tableau,  document.querySelector('#tableau'));
		//could put some sort of toggle here to make these only happen if it is your turn.
		var cards = document.querySelectorAll('#myHand .handContents .card');
		if(iAmCurrentPlayer){		
			for (i=0; i < cards.length; i++) {
				var card = cards[i];
				card.addEventListener('click', myHandAction);
			}
			cards = document.querySelectorAll('#othersHands .card');
			for (i=0; i < cards.length; i++) {
				var card = cards[i];
				card.addEventListener('click', clue);
			}
		}
	}

	// for debug perposes, make the game globally accessible
	window.gameObject = game;

}

