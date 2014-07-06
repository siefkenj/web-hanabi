"use strict"

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
	// grab the name and room from the URI search string, or put
	// in some defaults if they're not given.
	var args = parseUriSearchString(window.location.search);
	var name = args.name || 'Tom';
	var id = null;
	var room = args.room || 'innercircle';
	if (!args.name || !args.room) {
		window.location.search = "?name=" + encodeURI(name) + "&room=" + encodeURI(room);
	}
	
	// take a game object game and start the game
	function startNewGame(game) {
		console.log('got new game data. starting new game');
		document.querySelector('#game-screen').setAttribute('style', '')
		gameMode(name, id, game, socket);
		
	}

	console.log(args)
	var messagesDiv = document.querySelector('#messages');

	// Set up the web socket
	var socket = io.connect();
	window.ss = socket;
	socket.on('connect', function () {
		console.log('connected');
		// Set our name
		socket.emit('set-name', name);
		// Join the appropriate room as soon as we've connected
		socket.emit('set-room', room);
		// Get our ID from the server so we know where we
		// show up in the list of people in our room
		socket.emit('query-id');
	});
	socket.on('message', function(data) {
		console.log('Got data', data.message);
		if (data.message.type == 'new-game') {
			startNewGame(data.message.game);	
		}
	});
	//lists all the client and room data
	//the rooms are links to the room in question.
	//
	
	socket.on('room-info', function(data) {
		var everyoneReady = true;
		var i;
		var j;
		// If we are the first person on the list, we are the leader of the room,
		// so we should start the game.
		if (name == data.clients[0].name) {
			// If there is more than one person in the room and everyone
			// is ready, then let's start the game.
			if (data.clients.length > 1 && everyoneReady) {
				console.log('LEADER: everyone is ready')
				// We're the leader and everyone is ready, so 
				// prep the game object and broadcast it to everyone
				var game = prepGame(data);
				socket.emit('broadcast', {type: 'new-game', game: game});
				startNewGame(game);

			} else {
				console.log('LEADER: not everyone is ready')
			}
		}
	
	});
	socket.on('id-info', function(data) {
		console.log('Id info:', data);
		name = data.name;
		id = data.id;
	});
	

	//set ups is the button that sets the room and user data when clicked it runs the change function which sets the information in the URL
	//The 'setname' and 'roomname' functions are for the ability to press enter in either the set name or set room text inputs
	document.querySelector('#setUps').addEventListener('click', change);
	document.querySelector('#setName').addEventListener('keydown', enterData);
	document.querySelector('#roomName').addEventListener('keydown', enterData);

};
// prepare a game object for the players listed in roomInfo
function prepGame(roomInfo) {
	var game = createNewGame(roomInfo.clients.length);
	
	for (var i = 0; i < roomInfo.clients.length; i++){
		var player = roomInfo.clients[i];
		game.players[i].name = player.name;
		game.players[i].id = player.id;
	}

	return game;
}

// cheap hack so we can use all the function Andrei already made for us.
function gameMode(name, id, game, socket) {
	function broadcastNewGameState() {
		game.currentPlayer = game.currentPlayer + 1
		socket.emit('broadcast', {type: 'new-game', game: game});
	}
	function getPlayerById(game, id) {
		for (var i = 0; i < game.players.length; i++) {
			if (game.players[i].id == id) {
				return game.players[i];
			}
		}
	}

	// moved this from the individual functions it assumes we are the first player we need to make the names the same in order for the 
		//discard
		//updateScreen
	//functions to work, if you make a functions that requires this information make sure to add it here

	var myId = id;
	var others = []
	for (var i = 0; i < game.players.length; i++) {
		if (game.players[i].id != myId) {
			others.push(game.players[i]);
		}
	}
	var inAction = false;
	var iAmCurrentPlayer = false;
	
	// set up the active players hand
	var me = getPlayerById(game, myId);
	
	/*These are the player actions, clicking on a cars activates either the
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
            s += "<ul><li class='tellColor' title="+ target.title.substring(5) + ">Tell " + cardColor + "</li>";
            s += "<li class='tellNumber' title=" + target.title.substring(5) + ">Tell " + cardNumber + "</li>";
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
		var player = others[target.title];
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
		broadcastNewGameState();
		updateScreen(game);
		clearInstructions();
	}

	function setKnowledgeNumber(event){
		var target = event.currentTarget;
		var player = others[target.title];
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
		updateScreen(game);
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
		updateScreen(game);
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
			updateScreen(game);
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
	function setupHand(hand, parent) {
		var s = "<ul>";
		for (var i = 0; i < hand.length; i++) {
			s += "<li><img class='card' src='/images/cards/" + hand[i].number + "-" + hand[i].color + ".png' title=" + parent.parentNode.id + " />";
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
			s += "</div>"
			s += "</div>";
			s += "</li>";
		}
		s += "</ul>";
		parent.innerHTML = s;
	}

	//updates all data on the screen others variable is global and should be defined properly before project is done
	function updateScreen(game){
		var currPlayerId = game.players[game.currentPlayer % game.players.length].id;
		console.log(currPlayerId);
		console.log('currentPlayer', game.currentPlayer);
		iAmCurrentPlayer = (currPlayerId == myId);
		//setup your hand
		setupMyHand(me.hand, document.querySelector('#myHand .handContents'));
		// set up the other player's hands
		for (var i = 0; i < others.length; i++) {
			var other = others[i];

				document.querySelector('#other' + i + ' .playerName').textContent = other.name;
			setupHand(other.hand, document.querySelector('#other' + i + ' .handContents'));
			if (other.id == currPlayerId) {
				document.querySelector('#other' + i).setAttribute('style', 'background: orange')
			} else {
				document.querySelector('#other' + i).setAttribute('style', '')
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



	updateScreen(game)
	// for debug perposes, make the game globally accessible
	window.gameObject = game;

}
