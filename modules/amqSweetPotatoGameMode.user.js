// ==UserScript==
// @name        AMQ Sweet Potato Gamemode
// @description Sweet potato gamemode for Anime Music Quiz
// @match       https://*.animemusicquiz.com/*
// @version     1.0.0
// ==/UserScript==

/*
  To toggle the script, use the '/sweet' command
  For explanation of the gamemode, use '/sweet help'
*/

'use strict';

if (typeof Listener == 'undefined') return;

/* flags and state */
let potatoMode = false;

let potatoHolder = '';
let potatoPassed = false;

/* temporary events */
let inputBox = document.getElementById('qpAnswerInput');
let playerChoice = new Listener('team member answer', eventPlayerChoice);
let playerLeft = new Listener('Player Left', eventPlayerLeft);
let newTurn = new Listener('play next song', eventNewTurn);
let newGame = new Listener('quiz ready', eventNewGame);

/* general helper functions */

function sample(list) {
	/* pick a random sample from the list */
	return list[ Math.floor(Math.random() * list.length) ];
}

function normalize(s) {
	/* everything lowercase */
	s = s.toLowerCase();

	/* remove special characters */
	s = s.replace(/[^a-z0-9_]/g, '');

	return s;
}

function getTeam() {
	/* find our team number */
	let ownId = quiz.ownGamePlayerId;
	let teamId = quiz.players[ownId].teamNumber;

	/* find our team members */
	let team = [];

	for (let id in quiz.players) {
		let player = quiz.players[id];

		/* skip players not from our team */
		if (player.teamNumber != teamId)
			continue;

		/* skip players who logged off */
		if (player.avatarDisabled)
			continue;

		/* add player to list */
		team.push(player.name);
	}

	return team;
}

/* helper functions for answer and message submission */

function validQuiz() {
	return quiz.inQuiz && quiz.teamMode && !quiz.isSpectator && gameChat.displayJoinLeaveMessages;
}

function submitMsg(text) {
	let teamMessage = gameChat.teamChatSwitch.on;

	socket.sendCommand({
		type: 'lobby',
		command: 'game chat message',
		data: {
			msg: text,
			teamMessage
		}
	});
}

function submitInput(text) {
	socket.sendCommand({
		type: 'quiz',
		command: 'quiz answer',
		data: {
			answer: text
		}
	});
}

function submitStatus() {
	if (potatoPassed)
		submitInput(`🍠📝 ${potatoHolder}`);
	else
		submitInput(`🍠♨️ ${potatoHolder}`);
}

/* potato algorithm */

function setHolder(player) {
	potatoHolder = player;
	potatoPassed = true;
	submitStatus();
}

function passPotato(player, choice) {
	/* only admin or potato holder can pass */
	if (player != selfName && player != potatoHolder)
		return;

	/* skip if potato was already passed */
	if (potatoPassed)
		return;

	/* normalize player names */
	let holder = normalize(potatoHolder);
	let target = normalize(choice);

	/* skip empty string */
	if (target == '')
		return;

	/* find matching players */
	let team = getTeam();
	let found = [];

	for (let member of team) {
		let mate = normalize(member);

		/* skip holder */
		if (mate == holder)
			continue;

		/* stop on exact match */
		if (mate == target) {
			setHolder(member);
			return;
		}

		/* skip matching tiny strings */
		if (target.length < 3)
			continue;

		/* add matching players to list */
		if (mate.includes(target))
			found.push(member);
	}

	/* pass potato on single match */
	if (found.length == 1)
		setHolder(found[0]);
}

/* temporary handlers */

function eventNewGame(payload) {
	if (!validQuiz()) return;

	/* give potato to a random player */
	potatoHolder = sample(getTeam());
	potatoPassed = true;
}

function eventNewTurn(payload) {
	if (!validQuiz()) return;

	/* pass potato to someone if holder forgot to pass */
	let team = getTeam();

	if (!potatoPassed && team.length > 1)
		potatoHolder = sample(team.filter(p => p != potatoHolder));

	/* reset potato state */
	potatoPassed = false;
	submitStatus();
}

function eventPlayerLeft(payload) {
	if (!validQuiz()) return;

	/* pass potato to someone if holder logged off */
	if (payload.player.name == potatoHolder) {
		potatoHolder = sample(getTeam().filter(p => p != potatoHolder));
		potatoPassed = true;
		submitStatus();
	}
}

function eventPlayerChoice(payload) {
	if (!validQuiz()) return;

	/* pass potato to chosen player */
	let choice = payload.answer;
	let id = payload.gamePlayerId;
	let player = quiz.players[id].name;

	passPotato(player, choice);
}

function eventInputBox(payload) {
	if (!validQuiz()) return;

	/* send input to server */
	if (payload.data)
		submitInput(inputBox.value);
	else /* send status on backspace */
		submitStatus();
}

/* permanent handlers */

function handleMessage(packet) {
	let author = packet.sender;
	let msg = packet.message;

	/* command to toggle script */
	if (author == selfName && msg == '/sweet') {
		potatoMode = !potatoMode;

		if (potatoMode) {
			gameChat.systemMessage('🍠: ✅');

			/* run startup events */
			eventNewGame(null);
			eventNewTurn(null);

			/* enable temporary listeners */
			inputBox.addEventListener('input', eventInputBox);
			playerChoice.bindListener();
			playerLeft.bindListener();
			newTurn.bindListener();
			newGame.bindListener();
		} else {
			gameChat.systemMessage('🍠: ❌');

			/* disable temporary listeners */
			inputBox.removeEventListener('input', eventInputBox);
			playerChoice.unbindListener();
			playerLeft.unbindListener();
			newTurn.unbindListener();
			newGame.unbindListener();
		}
	/* command to show help info */
	} else if (author == selfName && msg == '/sweet help') {
		submitMsg('========================================');
		submitMsg('🍠 Sweet Potato Gamemode 🍠');
		submitMsg('Each turn, a player must pass the potato for someone to answer');
		submitMsg('♨️ means the player has to pass the potato');
		submitMsg('📝 means the player has to guess the anime');
		submitMsg('To pass the potato, say the name of the player');
		submitMsg('If the potato does not get passed, it will be given to a random player');
		submitMsg('========================================');
	/* pass potato when not a command */
	} else if (potatoMode)
		passPotato(author, msg);
}

function eventChatMessage(payload) {
	for (let packet of payload.messages)
		handleMessage(packet);
}

function eventTeamMessage(payload) {
	handleMessage(payload);
}

function setupListeners(payload) {
	/* bind permanent listeners */
	let teamMessage = new Listener('Game Chat Message', eventTeamMessage);
	let chatMessage = new Listener('game chat update', eventChatMessage);

	teamMessage.bindListener();
	chatMessage.bindListener();
}

setupListeners();
