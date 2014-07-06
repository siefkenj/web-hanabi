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
    
    socket.on('update-data', function(gameTemp){
        game = gameTemp;
	me = getPlayerById(game, myId);
        for (var i = 0; i < game.players.length; i++) {
	    	if (game.players[i].id != myId) {
                //others is now a list of the index of the player in the array of game.players
		    	others.push(i);
		    }
	    }
        updateScreen(game);
    });

	socket.on('id-info', function(data) {
		name = data.name;
		id = data.id;
	});


    function initializeGame(gameTemp){
      	for (var i = 0; i < game.players.length; i++) {
	    	if (game.players[i].id != myId) {
                //others is now a list of the index of the player in the array of game.players
		    	others.push(i);
		    }
	    }
	    me = getPlayerById(game, myId);
        updateScreen(game);
    }

    function broadcastNewGameState() {
		socket.emit('game-update', game);
	}
	function getPlayerById(gameTemp, id) {
		for (var i = 0; i < gameTemp.players.length; i++) {
			if (game.players[i].id == id) {
				return game.players[i];
			}
		}
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

	// returns a list of classes corresponding to
	// what is known about this card
	function getKnowledgeClasses(card) {
		var possibleKnowledge = ['red','green','blue','yellow','black','1','2','3','4','5'];
		var ret = [];
		for (var i = 0; i < possibleKnowledge.length; i++) {
			var possibility = possibleKnowledge[i];
			if ((card.impossible.indexOf(possibility)) == -1) {
				ret.push("maybe-" + possibility);
			}
		}
		return ret;
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
	// that all the cards should be displayed in.
	function setupHand(hand, parent, playerNumber) {
		var s = "<ul>";
		for (var i = 0; i < hand.length; i++) {
			s += "<li><img class='card' src='/images/cards/" + hand[i].number + "-" + hand[i].color + ".png' title=" + playerNumber + " />";
			// put all the information we know about possibilities for the card in one place
			s += "<div class='knowledge'>";
			for (var j=0, classList = getKnowledgeClasses(hand[i]); j < classList.length; j++) {
				var knowledgeClass = classList[j];
				s += "<div class='" + knowledgeClass +"'></div>"
			}
			s += "</div>";
			s += "</li>";

			}	
		parent.innerHTML = s;
	}
	// hand is the players hand, parent is the div
	// that all the cards should be displayed in

	// might be a better way to do this without using the title as the position but I couldnt see it

	function setupMyHand(hand, parent) {
		var s = "<ul>";
		for (var i = 0; i < hand.length; i++) {
			//uncomment this line and comment the one below it to see the card displayed
			//s += "<li><img class='card' src='/images/cards/" + hand[i].number + "-" + hand[i].color + ".png' title=" + i + " />";
			s += "<li><div class='card' title =" + i + ">"
			// put all the information we know about possibilities for the card in one place
			s += "<div class='knowledge'>";
			for (var j=0, classList = getKnowledgeClasses(hand[i]); j < classList.length; j++) {
				var knowledgeClass = classList[j];
				s += "<div class='" + knowledgeClass +"'></div>"
			}
			s += "</div>";
			s += "</div>";
			s += "</li>";
		}
		s += "</ul>";
		parent.innerHTML = s;
	}

	//updates all data on the screen others variable is global and should be defined properly before project is done
	function updateScreen(game){
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

