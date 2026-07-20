// ==UserScript==
// @name        AMQ Song/Artist Minimal
// @description S/A mode for Anime Music Quiz
// @match       https://*.animemusicquiz.com/*
// @resource    db https://files.catbox.moe/x88h2g.json
// @grant       GM_getResourceText
// @grant       GM_getValue
// @grant       GM_setValue
// @version     1.0.0
// ==/UserScript==

/*
  A simple and powerful implementation of S/A mode for AnimeMusicQuiz.
  Features a S/A mode in ~300 lines of userscript. No server needed.
  Comes with autokey. For best experience disable autokey from other scripts.

  To toggle the script, use the '/sa' command
  Database was last updated in 16 February 2025
*/

'use strict';

if (typeof Listener == 'undefined') return;

/* flags and state */
let saMode = false;

let songData = 'empty';
let statusSn = '❌';
let statusSa = '❌';
let saGuessed = 0;
let saList = [];

/* database */
let songDb = JSON.parse(GM_getResourceText('db'));
let localDb = GM_getValue('local', {});

/* anisongDb compatibility */
let anisongDb = GM_getValue('anisongDb', []);

/* temporary events */
let inputBox = document.getElementById('qpAnswerInput');
let playerAnswer = new Listener('team member answer', eventPlayerAnswer);

/* helper functions for answer validation */

function normalize(s, r) {
	/* everything lowercase */
	s = s.toLowerCase();

	/* isolate diacritics */
	s = s.normalize('NFD');

	/* remove special characters */
	s = s.replace(/[^a-z0-9]/g, r);

	return s;
}

function validAnswer(guess, answer) {
	guess = normalize(guess, '');
	answer = normalize(answer, '');

	return guess.includes(answer);
}

function validWords(guess, answer) {
	guess = normalize(guess, '');
	answer = normalize(answer, ' ');

	/* separate answer into words */
	let words = answer.split(' ');
	words = words.filter(w => w != '');

	/* check if any word is missing */
	for (let word of words)
		if (!guess.includes(word))
			return false;

	return true;
}

function validArtist(guess, artist) {
	for (let nick of artist)
		if (validWords(guess, nick))
			return true;

	return false;
}

function validSn(guess, song) {
	return validAnswer(guess, song[1]);
}

function validSa(guess, song) {
	let saText = validWords(guess, song[2]);

	/* skip invalid artist lists */
	if (saList.length == 0)
		return saText;

	/* eliminate guessed artists */
	for (let i = saList.length - 1; i >= 0; i--) {
		if (validArtist(guess, saList[i])) {
			saList.splice(i, 1);
			saGuessed++;
		}
	}

	/* win if everyone is eliminated */
	if (saList.length == 0)
		return true;

	return saText;
}

/* helper functions for fetching the video */

function getVideoList() {
	let player = quizVideoController.getCurrentPlayer();
	let videoMap = player['videoMap'];

	/* check which video host is being used */
	let host = videoMap['catbox'];

	if (!host) host = videoMap['openingsmoe'];

	/* push videos from best to worst quality */
	let videoList = [];

	if (host['720']) videoList.push(host['720']);
	if (host['480']) videoList.push(host['480']);
	if (host['0']) videoList.push(host['0']);

	return videoList;
}

function getVideoData(videoList) {
	let song;

	/* find video in database */
	for (let id of videoList) {
		if (song = songDb[id])
			break;

		if (song = localDb[id])
			break;
	}

	/* resolve any references */
	if (typeof song == 'string')
		song = songDb[song];

	return song;
}

/* helper functions for answer submission */

function validQuiz() {
	return quiz.inQuiz && !quiz.isSpectator && gameChat.displayJoinLeaveMessages;
}

function submitAnswer() {
	if (validQuiz())
		quiz.answerInput.setNewAnswer(songData[0]);
}

function submitInput(text) {
	if (validQuiz())
		socket.sendCommand({
			type: 'quiz',
			command: 'quiz answer',
			data: {
				answer: text
			}
		});
}

function submitStatus() {
	let status = `S/A ${statusSn}/${statusSa} (${saGuessed})`;

	if (quiz.teamMode)
		submitInput(status);
	else
		gameChat.systemMessage(status);
}

/* guessing algorithm */

function guessAnswer(guess) {
	let changed = false;
	let guessed = saGuessed;

	/* fetch song data */
	if (songData == 'empty') {
		songData = getVideoData(getVideoList());

		/* fail if song is not in database */
		if (!songData) {
			songData = 'void';
			statusSn = '💀';
			statusSa = '💀';
			changed = true;
		} else /* copy artist list */
			saList = songData[3].slice();
	}

	/* validate guesses */
	if (statusSn == '❌' && validSn(guess, songData)) {
		statusSn = '✅';
		changed = true;
	}

	if (statusSa == '❌' && validSa(guess, songData)) {
		statusSa = '✅';
		changed = true;
	}

	/* send any updates */
	if (!changed && guessed == saGuessed)
		return;

	submitStatus();

	if (statusSn == '✅' && statusSa == '✅') {
		quiz.skipController.voteSkip();
		quiz.answerInput.disable();
		submitAnswer();
	}
}

/* temporary handlers */

function eventPlayerAnswer(payload) {
	let answer = payload.answer;
	let id = payload.gamePlayerId;

	/* skip if game is already won */
	if (statusSn == '✅' && statusSa == '✅') {
		/* revert clicked answers */
		if (quiz.players[id].isSelf)
			submitAnswer();
	} else
		guessAnswer(answer);
}

function eventInputBox(payload) {
	/* send input to server on team mode */
	if (quiz.teamMode) {
		if (payload.data)
			submitInput(inputBox.value);
		else /* send status on backspace */
			submitStatus();
	} else
		guessAnswer(inputBox.value);
}

/* permanent handlers */

function eventAnswerResult(payload) {
	/* update database for current instance */
	localDb = GM_getValue('local', {});

	/* check for missing song in database */
	let videoList = getVideoList();
	let videoData = getVideoData(videoList);

	if (videoData)
		return;

	let videoId = videoList[0];

	/* skip other gamemodes */
	if (videoId.includes(':'))
		return;

	if (videoId.includes('amqbot'))
		return;

	/* create entry in local storage */
	let song = payload['songInfo'];
	let entry = [];

	entry.push(song['animeNames']['romaji']);
	entry.push(song['songName']);
	entry.push(song['artist']);
	entry.push([]);

	localDb[videoId] = entry;
	GM_setValue('local', localDb);

	/* anisongDb compatibility */
	anisongDb = GM_getValue('anisongDb', []);
	anisongDb.push(payload['songInfo']);
	GM_setValue('anisongDb', anisongDb);
}

function handleMessage(packet) {
	let msg = packet.message;
	let author = packet.sender;

	/* command to toggle script */
	if (msg == '/sa' && author == selfName) {
		saMode = !saMode;

		if (saMode) {
			gameChat.systemMessage('S/A: ✅');
			submitStatus();

			/* enable temporary listeners */
			inputBox.addEventListener('input', eventInputBox);
			playerAnswer.bindListener();
		} else {
			gameChat.systemMessage('S/A: ❌');

			/* disable temporary listeners */
			inputBox.removeEventListener('input', eventInputBox);
			playerAnswer.unbindListener();
		}
	} else if (saMode)
		guessAnswer(msg);
}

function eventVideoChange(payload) {
	/* reset game state */
	songData = 'empty';
	statusSn = '❌';
	statusSa = '❌';
	saGuessed = 0;
	saList = [];

	if (saMode)
		submitStatus();
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
	let videoChange = new Listener('play next song', eventVideoChange);
	let answerResult = new Listener('answer results', eventAnswerResult);

	teamMessage.bindListener();
	chatMessage.bindListener();
	videoChange.bindListener();
	answerResult.bindListener();
}

setupListeners();
