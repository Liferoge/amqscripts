// ==UserScript==
// @name         AMQ Song/Artist Bot Room Integration
// @namespace    http://tampermonkey.net/
// @version      6.4.6
// @description  try to take over the world!
// @author       You
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=animemusicquiz.com
// @downloadURL  https://gist.github.com/aynvmiki/45db1abf6f60a86812e08fe3f796bd2e/raw/AMQSongArtistIntegration.user.js
// @updateURL    https://gist.github.com/aynvmiki/45db1abf6f60a86812e08fe3f796bd2e/raw/AMQSongArtistIntegration.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

'use strict';

const DEFAULT_FILE_SERVER_URL = "https://amqbot-files.082640.xyz";

const CONFIG = {
    autoSendAnswers: GM_getValue("autoSendAnswers") ?? true,
    autoSkipWhenCorrect: GM_getValue("autoSkipWhenCorrect") ?? true,
    autoSkipWhenUndefined: GM_getValue("autoSkipWhenUndefined") ?? true,
    autoSkipAlways: GM_getValue("autoSkipAlways") ?? false,
    autoSkipStrings: GM_getValue("autoSkipStrings") ?? false,
    customSongListName: GM_getValue("customSongListName") ?? "",
    fileServerUrl: GM_getValue("fileServerUrl") ?? DEFAULT_FILE_SERVER_URL,
};

const AUTO_SKIP_STRINGS = ["/", "\\", "🏳", "/next", "all u"];

const FILE_SERVER_URLS = [
    { name: "canada-1", url: DEFAULT_FILE_SERVER_URL },
];

const SIGNALR_HUB_URL = `https://amqbot.082640.xyz/hub/sa`;

const handshakeString = "[0000]"

const messageHeaderString = "⠀";

const EVENT_NAME = {
    CONNECTED: "Connected",
    DISCONNECT: "Disconnect",
    PONG: "Pong",
    ANSWER: "PlayerAnswer",
    NEXT_SONG: "NextSong",
    SONG_CHECK: "SongCheck",
    ARTIST_CHECK: "ArtistCheck",
    SONG_GUESSED: "SongGuessed",
    ARTIST_GUESSED: "ArtistGuessed",
    RESULTS: "AnswerResults",
    CORRECT: "Correct",
    NEW_GAME_MODE_UPDATE: "NewGameModeUpdate",
    NEXT_VIDEO_INFO_OVERRIDE: "NextVideoInfoOverride",
    OVERRIDE_UPDATE: "OverrideUpdate",
    CUSTOM_LIST_SYNC_RESULT: "CustomListSyncResult",
    UGM_UPDATE: "UgmUpdate",
    SONG_METADATA_GUESSED: "SongMetadataGuessed",
}

/**
 * @readonly
 * @enum {number}
 */
const CONNECTION_STATE = {
    OFFLINE: 0,
    CONNECTING: 1,
    CONNECTED: 2,
    AUTHENTICATED: 3,
}

const signalRConnection = new signalR.HubConnectionBuilder()
    .withUrl(SIGNALR_HUB_URL)
    .configureLogging(signalR.LogLevel.Debug)
    .build();

/**
 * @type {CONNECTION_STATE}
 */
let connectionState = CONNECTION_STATE.OFFLINE;

const pingInterval = setInterval(pingConnection, 20000);

/**
 * @type {number | null}
 */
let lastPing = null;

/**
 * @type {boolean}
 */
let setupInstalled = false;

let configWindow;

// Styling for the custom elements created by this script
const css = GM_addStyle(`
#sai-container {
    position: absolute;
    top: 50px;
    right: 74px;
    background-color: black;
    padding: 0.2rem 0.5rem;
    user-select: none;
    display: flex;
    align-items: center;
    column-gap: 0.3rem;
    border: 2px solid #6f5a5a;
    border-radius: 6px;
    cursor: pointer;
}

#sai-container:hover {
    background-color: #202020;
    border-color: #666;
}

#sai-status-ping {
    font-size: 0.9rem;
}

#sai-status-icon {
    border-radius: 100%;
    width: 8px;
    height: 8px;
}

.sai-percent-check {
    font-size: 0.85em;
    margin-left: 0.3rem;
    white-space: nowrap;
}

.sai-percent-check.check-good {
    color: #76e598;
}

.sai-percent-check.check-close {
    color: #ffd77a;
}

.sai-percent-check.check-so {
    color: #ff997a;
}

.sai-percent-check.check-bad {
    color: #cd9b9b;
}

.sai-wrong-cross {
    color: #ff4848;
    margin-left: 0.3rem;
    vertical-align: middle;
}

.sai-undefined {
    color: #9b9b9b;
    font-style: italic;
}

.sai-guesses-left.its-over {
    color: #ff4545;
}

.sai-guesses-left.its-last-guess {
    color: #ffd32c;
}

.sai-guesses-total {
    color: #a1a1a1;
    font-size: 0.8em;
}

div#qpAnimeContainer > div > div.qpSideContainer > div.row {
    visibility: visible !important;
}
div#qpAnimeContainer > div > div.qpSideContainer > div.row.invisible-row {
    visibility: hidden !important;
}

.sai-checkbox {
    display: flex;
    margin: 8px;
}

.sai-checkbox > label {
    font-weight: normal;
    margin-left: 5px;
}

#sai-artist-info-icon, #sai-song-info-icon {
    position: absolute;
    padding: 0 6px;
    font-size: 18px;
    cursor: pointer;
}

#sai-artist-info-content, #sai-song-info-content {
    display: none;
}

.sai-artist-group {
    padding: 0 1rem;
    margin-top: 12px;
}

.sai-artist-group:last-child {
    margin-bottom: 12px;
}

.sai-artist-group-name {
    font-weight: bold;
    text-align: left;
    color: white;
    border-bottom: 1px solid #4c4c4c;
    margin-bottom: 4px;
    padding-bottom: 4px;
}

.sai-artist-group-member {
    text-align: left;
}

.sai-artist-group-missing {
    text-align: left;
    font-style: italic;
    color: #b7b7b7;
    font-size: 13px;
}

.sai-guess-role-container {
    position: absolute;
    left: 0px;
    top: -1px;
    height: calc(100% - 1px);
    width: 16px;
    padding: 2px 0;
    overflow: hidden;
    user-select: none;
}

.sai-guess-role-label {
    font-weight: bold;
    padding: 0px 3px;
    border-radius: 4px;
    height: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.sai-guess-role-song {
    background-color: #454ec5;
    margin-bottom: 2px;
}

.sai-guess-role-artist {
    background-color: #c5455c;
}

.sai-guess-role-hidden {
    opacity: 0;
}

.sai-guess-role-label.sai-guess-role-disabled {
    color: #8d8d8d;
    background-color: #4b4b4b;
}

.qpAvatarAnswerText.visible-guess-role {
    width: calc(100% - 18px);
    left: 18px;
}

.sai-extra-metadata-type {
    color: #9b9b9b;
}
`);

css.disabled = true;

// Script status bar interface elements
const integrationDiv = document.createElement("div");
integrationDiv.id = "sai-container";
integrationDiv.addEventListener('click', onStatusClicked);

const labelDiv = document.createElement("div");
labelDiv.id = "sai-label";
labelDiv.innerText = "🔨 S/A Integration";
integrationDiv.appendChild(labelDiv);

const statusPingDiv = document.createElement("div");
statusPingDiv.id = "sai-status-ping";
integrationDiv.appendChild(statusPingDiv);

const statusIconDiv = document.createElement("div");
statusIconDiv.id = "sai-status-icon";
integrationDiv.appendChild(statusIconDiv);

// Song info box elements
const songNameEl = document.createElement("p");
songNameEl.id = "sai-song-name";

const songNameTextEl = document.createElement("span");
songNameTextEl.id = "sai-song-name-text";
songNameEl.appendChild(songNameTextEl);

const songNameCheckEl = document.createElement("span");
songNameCheckEl.id = "sai-song-name-check";
songNameEl.appendChild(songNameCheckEl);

const artistNameEl = document.createElement("p");
artistNameEl.id = "sai-artist-name";

const artistNameTextEl = document.createElement("span");
artistNameTextEl.id = "sai-artist-name-text";
artistNameEl.appendChild(artistNameTextEl);

const artistNameCheckEl = document.createElement("span");
artistNameCheckEl.id = "sai-artist-name-check";
artistNameEl.appendChild(artistNameCheckEl);

const artistGroupInfoIconEl = document.createElement("i");
artistGroupInfoIconEl.id = "sai-artist-info-icon"
artistGroupInfoIconEl.className = "fa fa-info-circle";
artistGroupInfoIconEl.tabIndex = 0;

const artistGroupInfoContentEl = document.createElement("div");
artistGroupInfoContentEl.id = "sai-artist-info-content";

const songMetadataInfoIconEl = document.createElement("i");
songMetadataInfoIconEl.id = "sai-song-info-icon"
songMetadataInfoIconEl.className = "fa fa-info-circle";
songMetadataInfoIconEl.tabIndex = 0;

const songMetadataInfoContentEl = document.createElement("div");
songMetadataInfoContentEl.id = "sai-song-info-content";

const artists = {
    map: new Map(),
    totalCount: 0,
    guessed: false,
}

const ngm = {
    guessesLeft: 0,
    lastGuess: false,
    active: false,
}

const song = {
    name: "",
    time: 0,
}

const extraMetadata = {
    song: new Map(),
    artist: new Map(),
}

// Answer input replacement
const answerInput = document.createElement("input");
answerInput.id = "sai-answer-input"
answerInput.type = "text";
answerInput.className = "flatTextInput";
answerInput.maxLength = 255;
answerInput.autocomplete = "off";
answerInput.placeholder = "Song or Artist Name";

const answerInputContainerObserver = new MutationObserver(onInputContainerMutation);

let setupInputContainerObserver;

let originalTeamMemberAnswerCallback;
let originalPlayerAnswerCallback;

let originalNextVideoInfoCallback;
let originalQuizReadyCallback;
let originalPlayerAnswersCallback;

let originalDisplayAnimeName;
let originalListStatus;
let originalListScore;
let originalAddNewSong;

let originalLobbyViewSettings;
let originalChangeGameSettings;

let csRigCounter = {};

let amqAnswerResults = null;
let botAnswerResults = null;

signalRConnection.on(EVENT_NAME.CONNECTED, onConnect);
signalRConnection.on(EVENT_NAME.DISCONNECT, onDisconnect);
signalRConnection.on(EVENT_NAME.PONG, onPong);
signalRConnection.on(EVENT_NAME.ANSWER, onPlayerAnswer);
signalRConnection.on(EVENT_NAME.RESULTS, onAnswerResults);
signalRConnection.on(EVENT_NAME.NEXT_SONG, onNextSong);
signalRConnection.on(EVENT_NAME.CORRECT, onCorrectSongArtist);
signalRConnection.on(EVENT_NAME.SONG_CHECK, onSongCheckUpdate);
signalRConnection.on(EVENT_NAME.ARTIST_CHECK, onArtistCheckUpdate);
signalRConnection.on(EVENT_NAME.SONG_GUESSED, onSongGuessed);
signalRConnection.on(EVENT_NAME.ARTIST_GUESSED, onArtistGuessed);
signalRConnection.on(EVENT_NAME.NEW_GAME_MODE_UPDATE, onNewGameModeUpdate);
signalRConnection.on(EVENT_NAME.NEXT_VIDEO_INFO_OVERRIDE, onNextVideoInfoOverride);
signalRConnection.on(EVENT_NAME.OVERRIDE_UPDATE, onOverrideUpdate);
signalRConnection.on(EVENT_NAME.CUSTOM_LIST_SYNC_RESULT, onCustomListSyncResult);
signalRConnection.on(EVENT_NAME.UGM_UPDATE, onUgmUpdate);
signalRConnection.on(EVENT_NAME.SONG_METADATA_GUESSED, onSongMetadataGuessed);
signalRConnection.onclose(onConnectionClose);

/**
 * @param {string} token
 * @returns {Promise<void>}
 */
async function connectSignalR(token) {
    if (connectionState === CONNECTION_STATE.AUTHENTICATED || connectionState === CONNECTION_STATE.CONNECTING) {
        return;
    }

    setupIntegration();
    setConnectionStatus(CONNECTION_STATE.CONNECTING);

    try {
        if (!isConnected()) {
            await signalRConnection.start();
            setConnectionStatus(CONNECTION_STATE.CONNECTED);
            console.log("SignalR Connected.");
        }
        await signalRConnection.invoke("Authenticate", selfName, token, GM_info.script.version);
    } catch (err) {
        setConnectionStatus(CONNECTION_STATE.OFFLINE);
        console.log(err);
    }
}

async function onConnect() {
    setConnectionStatus(CONNECTION_STATE.AUTHENTICATED);
    await pingConnection();
}

async function onDisconnect() {
    try {
        await signalRConnection.stop();
    } catch (err) {
        console.log(err);
    }
}

async function onConnectionClose() {
    console.log("SignalR Disconnected.");
    setConnectionStatus(CONNECTION_STATE.OFFLINE);
}

async function onPong() {
    const latency = (Date.now() - lastPing) / 2;
    setConnectionStatus(connectionState, latency);
}

async function pingConnection() {
    if (!isConnected() || connectionState !== CONNECTION_STATE.AUTHENTICATED) {
        return;
    }

    lastPing = Date.now();
    await signalRConnection.invoke("Ping");
}

/**
 * @param {number} videoId
 * @param {string?} url
 * @param {number} playLength
 * @param {number} startPoint
 * @param {boolean} forceBuffering
 */
function onNextVideoInfoOverride(videoId, url, playLength, startPoint, forceBuffering) {
    const videoInfo = {
        id: videoId,
        videoMap: {
            catbox: {
                720: resolveVideoUrl(url)
            }
        },
        videoVolumeMap: {},
        guessMode: {
            blurVideo: false,
            tinyVideo: false,
            song: true,
        },
    };

    quizVideoController.nextVideoInfo(videoInfo, playLength, startPoint, true, null, 1, quiz.fullSongRange, forceBuffering);
    quiz.nextSongPlayLength = playLength;
}

/**
 * @param {boolean} enabled
 */
async function onOverrideUpdate(enabled) {
    enabled ? setupOverride() : removeOverride();

    if (enabled && CONFIG.customSongListName) {
        await signalRConnection.invoke("SetCustomList", CONFIG.customSongListName);
    }
}

/**
 * @param {{
 *     playerGuesses: {
 *         id: number,
 *         count: number,
 *         lastGuess: boolean
 *     }[],
 *     totalGuesses: number
 * }} message
 */
async function onNewGameModeUpdate(message) {
    for (const {id, count, lastGuess} of message.playerGuesses) {
        if (id === quiz.ownGamePlayerId) {
            ngm.guessesLeft = count;
            ngm.lastGuess = lastGuess;
            ngm.active = true;
        }

        const containerDiv = quiz.players[id].avatarSlot.$hiddenIconContainer.get(0);
        containerDiv.classList.remove("hide");

        const guessesDiv = containerDiv.firstElementChild;
        guessesDiv.innerText = "";

        const guessesLeftSpan = document.createElement("span");
        guessesLeftSpan.className = "sai-guesses-left";
        guessesLeftSpan.innerText = `${count}`;
        guessesDiv.appendChild(guessesLeftSpan);

        if (lastGuess || count === 1) { // team is on last guess
            guessesLeftSpan.classList.add("its-last-guess");
        } else if (count === 0) {
            guessesLeftSpan.classList.add("its-over");
        } else if (count === message.totalGuesses) {
            guessesLeftSpan.classList.add("its-full");
        }

        const totalGuessesSpan = document.createElement("span");
        totalGuessesSpan.className = "sai-guesses-total";

        totalGuessesSpan.innerText = `/${message.totalGuesses}`;
        guessesDiv.appendChild(totalGuessesSpan);
    }
}

/**
 * @param {{
 *     players: {
 *         id: number,
 *         guessRole: number
 *     }[],
 * }} message
 */
async function onUgmUpdate(message) {
    if (!quiz.players) {
        return;
    }

    for (const {id, guessRole} of message.players) {
        let containerDiv = quiz.players[id].avatarSlot.$answerContainer.find(".sai-guess-role-container");

        if (containerDiv.length === 0) {
            containerDiv = $(`
                <div class="sai-guess-role-container">
                    <div class="sai-guess-role-label sai-guess-role-song">S</div>      
                    <div class="sai-guess-role-label sai-guess-role-artist">A</div>      
                </div>
            `);
            quiz.players[id].avatarSlot.$answerContainer.append(containerDiv);
        }

        const songRoleDiv = containerDiv.find(".sai-guess-role-song").addClass("sai-guess-role-hidden");
        const artistRoleDiv = containerDiv.find(".sai-guess-role-artist").addClass("sai-guess-role-hidden");

        // 0 = None
        // 1 = Song
        // 2 = Artist guess role
        // 3 = Song & Artist
        if (guessRole === 1 || guessRole === 3) {
            songRoleDiv.removeClass("sai-guess-role-hidden sai-guess-role-disabled");
        }

        if (guessRole === 2 || guessRole === 3) {
            artistRoleDiv.removeClass("sai-guess-role-hidden sai-guess-role-disabled");
        }

        quiz.players[id].avatarSlot.$answerContainerText.addClass("visible-guess-role");
    }

    setTimeout(() => {
        Object.values(quiz.players).forEach(player => player.answer = "");
    }, 100);
}

/**
 * @param {{defined: boolean, artistCount: number | undefined}} message
 */
async function onNextSong(message) {
    resetSongInfo();

    if (!message.defined) {
        songNameTextEl.innerText = "(undefined)";
        artistNameTextEl.innerText = "(undefined)";

        songNameCheckEl.innerText = null;
        artistNameCheckEl.innerText = null;

        songNameEl.classList.add("sai-undefined");
        artistNameEl.classList.add("sai-undefined");

        if (CONFIG.autoSkipWhenUndefined) {
            amqVoteSkip(true);
        }
    }

    if (message.artistCount) {
        artists.totalCount = message.artistCount;
    }
}

/**
 * @param {{animeName: string}} message
 */
async function onCorrectSongArtist(message) {
    if (CONFIG.autoSkipWhenCorrect) {
        amqVoteSkip(true);
    }

    amqSendAnswer(message.animeName);
}

/**
 * @param {{
 *     dbSong: {
 *         name: string,
 *         artist: string
 *     }?,
 *     newSongName: string,
 *     newArtistName: string,
 *     songGuessed: boolean,
 *     artistGuessed: boolean,
 *     customSong: {
 *         groupName: string,
 *         otherGroupNames: string[],
 *         album: string,
 *         fileUrl: string,
 *         listStatus: number[]
 *     }?,
 *     artistGroups: {
 *         name: string,
 *         members: string[]
 *     }[],
 *     extraMetadata: {
 *         type: string,
 *         values: string[]
 *     }[]
 * }} message
 */
async function onAnswerResults(message) {
    if (amqAnswerResults !== null) {
        onCombinedAnswerResults(amqAnswerResults, message);
    }
    else {
        botAnswerResults = message;
    }

    artistGroupInfoContentEl.innerHTML = null;
    songMetadataInfoContentEl.innerHTML = null;

    $("#qpExtraSongInfo").parent().removeClass("invisible-row");

    if (message.customSong) {
        originalDisplayAnimeName.apply(quiz.infoContainer, [
            message.customSong.groupName,
            message.customSong.otherGroupNames
        ]);

        $("#qpSongVideoLink").attr("href", resolveVideoUrl(message.customSong.fileUrl));
        $("#qpAnimeLink").attr("href", "#");

        for (const player of Object.values(quiz.players)) {
            const id = player.gamePlayerId;

            if (!player.avatarSlot.answer) {
                player.avatarSlot.answer = "...";
            }

            if (message.customSong.listStatus.includes(id)) {
                player.avatarSlot.answerStatus.status = 1; //LIST_STATUS.WATCHING
                player.avatarSlot.answerStatus.score = csRigCounter[id] = (csRigCounter[id] || 0) + 1;
            }
        }
    }

    if (message.artistGroups.length > 0) {
        for (const group of message.artistGroups) {
            const groupDiv = document.createElement("div");
            groupDiv.className = "sai-artist-group";
            artistGroupInfoContentEl.appendChild(groupDiv);

            const groupName = document.createElement("div");
            groupName.className = "sai-artist-group-name";
            groupName.innerText = group.name;
            groupDiv.appendChild(groupName);

            if (group.members.length === 0) {
                const msgEl = document.createElement("div");
                msgEl.className = "sai-artist-group-missing";
                msgEl.innerText = "(undefined)";
                groupDiv.appendChild(msgEl);
                continue;
            }

            for (const artist of group.members) {
                const artistEl = document.createElement("div");
                artistEl.className = "sai-artist-group-member";
                artistEl.innerText = artist;
                groupDiv.appendChild(artistEl);
            }
        }

        artistGroupInfoIconEl.classList.remove("hidden");
    }

    if (message.extraMetadata.length > 0) {
        const sortOrder = ["Composer", "Arranger", "Lyricist", "Remixer"];

        message.extraMetadata.sort((a, b) => {
            const indexOfA = sortOrder.indexOf(a.type);
            const indexOfB = sortOrder.indexOf(b.type);

            if (indexOfB === -1) return -1;
            if (indexOfA === -1) return 1;

            return indexOfA - indexOfB;
        });

        for (const metadataGroup of message.extraMetadata) {
            const groupDiv = document.createElement("div");
            groupDiv.className = "sai-artist-group";
            songMetadataInfoContentEl.appendChild(groupDiv);

            const groupName = document.createElement("div");
            groupName.className = "sai-artist-group-name";
            groupName.innerText = metadataGroup.type;
            groupDiv.appendChild(groupName);

            for (const value of metadataGroup.values) {
                const valueEl = document.createElement("div");
                valueEl.className = "sai-artist-group-member";
                valueEl.innerText = value;
                groupDiv.appendChild(valueEl);
            }
        }

        songMetadataInfoIconEl.classList.remove("hidden");
    }

    if (!message.dbSong) {
        // song is not in the db
        songNameEl.classList.remove("sai-undefined");
        artistNameEl.classList.remove("sai-undefined");

        songNameTextEl.innerText = message.newSongName;
        artistNameTextEl.innerText = message.newArtistName;

        return;
    }

    if (message.songGuessed) {
        songNameTextEl.innerText = message.newSongName;
        songNameEl.classList.add("sai-correct-info");
    } else {
        songNameCheckEl.innerText = "×";
        songNameCheckEl.className = "sai-wrong-cross";

        songNameTextEl.innerText = message.newSongName;
    }

    if (message.artistGuessed) {
        artistNameTextEl.innerText = message.newArtistName;
        artistNameEl.classList.add("sai-correct-info");
    } else {
        artistNameCheckEl.innerText = "×";
        artistNameCheckEl.className = "sai-wrong-cross";

        artistNameTextEl.innerText = message.newArtistName;
    }
}

function onCombinedAnswerResults(amqResults, botResults) {
    amqAnswerResults = null;
    botAnswerResults = null;

    if (botResults.customSong) {
        const songInfo = {
            isCustomSong: true,
            altAnimeNames: botResults.customSong.otherGroupNames,
            altAnimeNamesAnswers: [],
            animeDifficulty: 0,
            animeGenre: [botResults.customSong.album],
            animeNames: {
                english: botResults.customSong.groupName,
                romaji: botResults.customSong.groupName,
            },
            animeScore: 0,
            animeTags: [],
            animeType: "-",
            annId: 0,
            artist: botResults.newArtistName,
            highRisk: 0,
            siteIds: { annId: 0, malId: 0, kitsuId: 0, aniListId: 0 },
            songName: botResults.newSongName,
            type: 3,
            typeNumber: 0,
            urlMap: {
                catbox: {
                    0: resolveVideoUrl(botResults.customSong.fileUrl)
                }
            },
            vintage: "-",
            composerInfo: {},
            arrangerInfo: {},
        }

        const player = Object.values(quiz.players).find(p => p.isSelf);

        const correctGuess = amqResults.players
            .find(p => p.gamePlayerId === player?.gamePlayerId)?.correct || false;

        const correctGuessPlayers = amqResults.players
            .filter(p => p.correct)
            .map(p => quiz.players[p.gamePlayerId].name);

        let songHistoryInfo = {
            songNumber: quiz.infoContainer.currentSongNumber,
            songInfo,
            correctGuess,
            wrongGuess: !correctGuess && !quiz.isSpectator,
            answer: player?.answer,
            correctCount: correctGuessPlayers.length,
            wrongCount: amqResults.players.length - correctGuessPlayers.length,
            startPoint: quizVideoController.getCurrentVideoStartPoint(),
            videoLength: quizVideoController.getCurrentVideoLength(),
            videoUrl: resolveVideoUrl(botResults.customSong.fileUrl),
            correctGuessPlayers,
            listStates: Object.values(quiz.players)
                .filter(p => botResults.customSong.listStatus.includes(p.gamePlayerId))
                .map(p => ({
                    name: p.name,
                    status: 1,
                    score: null,
                })),
        };

        originalAddNewSong.apply(songHistoryWindow, [
            songHistoryInfo,
            quiz.quizDescription
        ]);
    }
}

/**
 * @param {{
 *     similarity: number,
 *     answer: string?
 * }} message
 */
async function onSongCheckUpdate(message) {
    const className = getCheckClass(message.similarity);
    songNameCheckEl.className = "sai-percent-check";
    songNameCheckEl.classList.add(className);

    songNameCheckEl.innerText = `(${Math.floor(message.similarity * 100)}%)`

    songNameTextEl.innerText = message.answer;
}

/**
 * @param {{
 *     time: number,
 *     answer: string,
 *     similarity: number,
 *     playerName: string
 * }} message
 */
async function onSongGuessed(message) {
    song.name = message.answer;
    song.time = message.time;
    drawSong();
    disableGuessRoles(true, false);
}

/**
 * @param {{
 *     guesses: {
 *         similarity: number,
 *         answer: string?,
 *         index: number
 *     }[]
 * }} message
 */
async function onArtistCheckUpdate(message) {
    for (let i = 0; i < message.guesses.length; i++) {
        const artistGuess = message.guesses[i];

        const {answer, similarity, index} = artistGuess;

        let artist = artists.map.get(index);

        if (!artist) {
            artist = {
                index: index,
                answer,
                similarity,
                guessed: false,
                time: null,
            };
            artists.map.set(index, artist);
            continue;
        }

        if (similarity > artist.similarity) {
            artist.answer = answer;
            artist.similarity = similarity;
            artists.map.set(index, artist);
        }
    }

    drawArtists();
}

/**
 * @param {{
 *     answer: string,
 *     similarity: number,
 *     index: number,
 *     playerName: string,
 *     time: number,
 *     totalCount: number,
 *     allGuessed: boolean
 * }} message
 */
async function onArtistGuessed(message) {
    const {answer, similarity, index, time, totalCount, allGuessed} = message;

    let artist = artists.map.get(index);

    if (!artist) {
        artist = {
            index: index,
            answer,
            similarity,
            guessed: true,
            time,
        };
    } else {
        artist.guessed = true;
        artist.answer = answer;
        artist.similarity = similarity;
        artist.time = time;
    }

    artists.map.set(index, artist);
    artists.guessed = allGuessed;
    artists.totalCount = totalCount;

    drawArtists();

    if (allGuessed) {
        disableGuessRoles(false, true);
    }
}

/**
 * @param {{
*     answer: string,
*     type: string,
*     isArtist: boolean,
* }} message
*/
async function onSongMetadataGuessed(message) {
    if (message.isArtist) {
        const artist = extraMetadata.artist.get(message.answer);

        if (artist) {
            artist.add(message.type);
        }
        else {
            const types = new Set();
            types.add(message.type);
            extraMetadata.artist.set(message.answer, types);
        }

        drawArtists();
        return;
    }

    const song = extraMetadata.song.get(message.answer);

    if (song) {
        song.add(message.type);
    }
    else {
        const types = new Set();
        types.add(message.type);
        extraMetadata.song.set(message.answer, types);
    }

    drawSong();
}

/**
 * @param {string} name
 * @param {boolean} successful
 * @param {string} message
 */
function onCustomListSyncResult(name, successful, message) {
    if (!successful) {
        $("#list-sync-status").text(message);
        return;
    }

    CONFIG.customSongListName = name;
    GM_setValue("customSongListName", CONFIG.customSongListName);
    $("#list-sync-status").text(message);
}

function drawSong() {
    songNameTextEl.innerText = null;

    if (song.name !== "" && song.time > 0) {
        const answerSpan = document.createElement("span");
        answerSpan.innerText = song.name;
        songNameTextEl.appendChild(answerSpan);

        songNameCheckEl.className = "sai-percent-check check-good";
        songNameCheckEl.innerText = `(+${song.time.toFixed(1)}s)`;
    }

    if (extraMetadata.song.size > 0) {
        if (songNameTextEl.childElementCount > 0) {
            const separatorSpan = document.createElement("span");
            separatorSpan.innerText = ", ";
            songNameTextEl.appendChild(separatorSpan);
        }

        for (const [songMetadata, types] of extraMetadata.song.entries()) {
            const answerSpan = document.createElement("span");
            answerSpan.innerText = songMetadata;
            songNameTextEl.appendChild(answerSpan);

            const typesSpan = document.createElement("span");
            typesSpan.className = "sai-extra-metadata-type";
            typesSpan.innerText = " (" + Array.from(types).join(", ") + ")";
            songNameTextEl.appendChild(typesSpan);

            const separatorSpan = document.createElement("span");
            separatorSpan.innerText = ", ";
            songNameTextEl.appendChild(separatorSpan);
        }

        songNameTextEl.removeChild(songNameTextEl.lastChild);
    }
}

function drawArtists() {
    artistNameTextEl.innerText = null;

    const artistsList = Array.from(new Map([...artists.map.entries()].sort()).values());

    /*
    if (artists.totalCount === 1) {
        const artist = artistsList.pop();

        artistNameTextEl.innerText = artist.answer;

        artistNameCheckEl.className = "sai-percent-check";
        artistNameCheckEl.innerText = `(${Math.floor(artist.similarity * 100)}%)`;

        const className = getCheckClass(artist.similarity);
        artistNameCheckEl.classList.add(className);

        if (artist.guessed && artists.totalCount === 1) {
            artistNameCheckEl.innerText = `(+${artist.time.toFixed(1)}s)`;
        }

        return;
    }

    if (!artistsList.some(a => a.guessed)) {
        const bestSimilarity = artistsList.map(a => a.similarity).sort().pop();
        artistNameCheckEl.className = "sai-percent-check";
        artistNameCheckEl.innerText = `(${Math.floor(bestSimilarity * 100)}%)`;

        const className = getCheckClass(bestSimilarity);
        artistNameCheckEl.classList.add(className);

        return;
    }
    */

    const filteredArtistsList = artistsList.filter((a) => a.similarity >= 0.5);
    const filteredArtistsLength = filteredArtistsList.length;

    filteredArtistsList.forEach((artist, index) => {
        const answerSpan = document.createElement("span");
        answerSpan.innerText = artist.answer;
        artistNameTextEl.appendChild(answerSpan);

        if (!artist.guessed) {
            const className = getCheckClass(artist.similarity);
            const percentSpan = document.createElement("span");

            percentSpan.innerText = `(${Math.floor(artist.similarity * 100)}%)`
            percentSpan.className = "sai-percent-check";
            percentSpan.classList.add(className);

            artistNameTextEl.appendChild(percentSpan);
        }

        if (index < filteredArtistsLength - 1) {
            const separatorSpan = document.createElement("span");
            separatorSpan.innerText = ", ";
            artistNameTextEl.appendChild(separatorSpan);
        }
    });

    if (extraMetadata.artist.size > 0) {
        if (artistNameTextEl.childElementCount > 0) {
            const separatorSpan = document.createElement("span");
            separatorSpan.innerText = ", ";
            artistNameTextEl.appendChild(separatorSpan);
        }

        for (const [artist, types] of extraMetadata.artist.entries()) {
            const answerSpan = document.createElement("span");
            answerSpan.innerText = artist;
            artistNameTextEl.appendChild(answerSpan);

            const typesSpan = document.createElement("span");
            typesSpan.className = "sai-extra-metadata-type";
            typesSpan.innerText = " (" + Array.from(types).join(", ") + ")";
            artistNameTextEl.appendChild(typesSpan);

            const separatorSpan = document.createElement("span");
            separatorSpan.innerText = ", ";
            artistNameTextEl.appendChild(separatorSpan);
        }

        artistNameTextEl.removeChild(artistNameTextEl.lastChild);
    }

    const guessedCount = artistsList.filter(a => a.guessed).length;

    artistNameCheckEl.className = "sai-percent-check";

    if (artists.guessed) {
        const lastGuessedTime = filteredArtistsList
            .map(a => a.time)
            .sort((a, b) => a - b)
            .pop();
        artistNameCheckEl.innerText = `(+${lastGuessedTime.toFixed(1)}s)`;
        artistNameCheckEl.classList.add("check-good");
        return;
    }

    var totalCount = artists.totalCount === -1 ? "?" : artists.totalCount.toString();

    artistNameCheckEl.innerText = `(${guessedCount}/${totalCount})`;

    const guessedPercent = artists.totalCount === -1 ? 0.8 : guessedCount / artists.totalCount;

    const className = getCheckClass(guessedPercent);

    artistNameCheckEl.classList.add(className);
}

/**
 * @param percent
 * @returns string
 */
function getCheckClass(percent) {
    if (percent >= 0.99) {
        return "check-good";
    } else if (percent >= 0.7) {
        return "check-close";
    } else if (percent >= 0.4) {
        return "check-so";
    } else {
        return "check-bad";
    }
}

/**
 * @param {number} id
 * @param {string} answer
 */
function onPlayerAnswer(id, answer) {
    if (!quiz || !quiz.inQuiz || !quiz.players) {
        return;
    }

    const quizPlayer = quiz.players[id];

    quizPlayer.answer = answer;
    quizPlayer.avatarPose = cdnFormater.AVATAR_POSE_IDS.WAITING;
}

/**
 * @param {InputEvent} event
 */
async function onAnswerInput(event) {
    if (event.inputType === "insertText" && event.data === ":") {
        event.target.value = translateShortcodeToUnicode(event.target.value).text;
    }

    if (CONFIG.autoSkipStrings && AUTO_SKIP_STRINGS.includes(event.target.value)) {
        amqVoteSkip(true);
    }

    if (!quiz || !quiz.inQuiz || !CONFIG.autoSendAnswers) {
        return;
    }

    await sendAnswer(event.target.value);
}

/**
 * @param {KeyboardEvent} event
 */
async function onAnswerKeydown(event) {
    if (CONFIG.autoSendAnswers || event.key !== "Enter") {
        return;
    }

    await sendAnswer(event.target.value);
}

/**
 * @param {PointerEvent} event
 */
function onStatusClicked(event) {
    if (!configWindow) {
        return;
    }

    try {
        $("#list-name-input").val(CONFIG.customSongListName);
        $("#list-sync-status").text("");

        if (typeof configWindow.open === "function") {
            configWindow.open();
        }

        if (typeof configWindow.bringToFront === "function") {
            configWindow.bringToFront();
        }

        if (typeof configWindow.focus === "function") {
            configWindow.focus();
        }
    } catch (error) {
        console.error("Failed to open S/A Integration panel:", error);
    }
}

/**
 * @param {KeyboardEvent} event
 */
async function onGameChatKeydown(event) {
    if (event.key !== "Enter") {
        return;
    }

    const message = event.target.value.trim();

    if (message === "") {
        return;
    }

    await sendAnswer(message, true);
}

async function updateCustomList() {
    const listName = $("#list-name-input").val().trim();

    if (listName.length < 1) {
        $("#list-sync-status").text("");
        return;
    }

    $("#list-sync-status").text("Updating...");

    await signalRConnection.invoke("SetCustomList", listName);
}

/**
 * @param {string} answer
 * @param {boolean} chatMessage
 */
async function sendAnswer(answer, chatMessage = false) {
    if (!isConnected()) {
        return;
    }

    await signalRConnection.invoke("SendPlayerAnswer", answer, chatMessage);
}

function resetSongInfo() {
    const qpSongType = document.getElementById("qpSongType");
    qpSongType.innerText = "?";

    songNameEl.removeAttribute("class");
    songNameTextEl.innerText = "?";
    songNameCheckEl.innerText = null;

    artistNameEl.removeAttribute("class");
    artistNameTextEl.innerText = "?";
    artistNameCheckEl.innerText = null;
    artistGroupInfoIconEl.classList.add("hidden");

    artists.map.clear();
    artists.totalCount = 0;
    artists.guessed = false;

    extraMetadata.song.clear();
    extraMetadata.artist.clear();

    song.name = "";
    song.time = 0;

    songMetadataInfoIconEl.classList.add("hidden");

    $("#qpExtraSongInfo").parent().addClass("invisible-row");

    $(songMetadataInfoIconEl).popover("hide");
    $(artistGroupInfoIconEl).popover("hide");
}

/**
 * @param {boolean} song
 * @param {boolean} artist
 */
function disableGuessRoles(song, artist) {
    if (!quiz.players) {
        return;
    }

    for (const player of Object.values(quiz.players)) {
        const containerDiv = player.avatarSlot.$answerContainer.find(".sai-guess-role-container");

        if (containerDiv.length === 0) {
            break;
        }

        if (song) {
            containerDiv.find(".sai-guess-role-song").addClass("sai-guess-role-disabled");
        }

        if (artist) {
            containerDiv.find(".sai-guess-role-artist").addClass("sai-guess-role-disabled")
        }
    }
}

/**
 * @param {CONNECTION_STATE} state
 * @param {number} ping
 */
function setConnectionStatus(state, ping = 0) {
    connectionState = state;

    switch (connectionState) {
        case CONNECTION_STATE.OFFLINE:
            statusIconDiv.style.background = "red";
            statusPingDiv.innerText = "Offline";
            statusPingDiv.style.color = "red";
            break;

        case CONNECTION_STATE.CONNECTING:
            statusIconDiv.style.background = "yellow";
            statusPingDiv.innerText = "Connecting";
            statusPingDiv.style.color = "yellow";
            break;

        case CONNECTION_STATE.CONNECTED:
            statusIconDiv.style.background = "yellow";
            statusPingDiv.innerText = "Not authenticated";
            statusPingDiv.style.color = "yellow";
            break;

        case CONNECTION_STATE.AUTHENTICATED:
            statusIconDiv.style.background = "green";
            statusPingDiv.innerText = `${Math.round(ping)}ms`;
            statusPingDiv.style.color = "";
            break;
    }
}

/**
 * @param {string} answer
 */
function amqSendAnswer(answer) {
    socket.sendCommand({
        type: "quiz",
        command: "quiz answer",
        data: {
            answer,
            isPlaying: true,
            volumeAtMax: false
        }
    });
}

function amqVoteSkip(skipVote = true) {
    socket.sendCommand({
        type: "quiz",
        command: "skip vote",
        data: {
            skipVote,
        }
    });

    quiz.skipController.toggled = skipVote;
}

function amqSendPrivateMessage(target, message) {
    socket.sendCommand({
        type: "social",
        command: "chat message",
        data: {
            target,
            message
        }
    });
}

/**
 * @param {MutationRecord[]} records
 * @param {MutationObserver} observer
 */
function onInputContainerMutation(records, observer) {
    for (let record of records) {
        for (let addedNode of record.addedNodes) {
            if (addedNode.classList.contains("awesomplete")) {
                addedNode.style.display = isConnected() ? "none" : "";
                break;
            }
        }
    }
}

function setupIntegration() {
    if (setupInstalled) {
        return;
    }

    console.log("setupIntegration");

    const gamePage = document.getElementById("gameChatPage").firstElementChild;
    gamePage.appendChild(integrationDiv);

    const answerInputContainer = document.getElementById("qpAnswerInputContainer");

    answerInputContainerObserver.observe(answerInputContainer, {childList: true});

    const awesomplete = answerInputContainer.querySelector('.awesomplete');

    if (awesomplete) {
        awesomplete.style.display = "none";
        answerInputContainer.prepend(answerInput);
    } else {
        // Needed because awesomplete is not setup until the first game starts
        setupInputContainerObserver = new MutationObserver((mutationRecords, mutationObserver) => {
            const addedAwesomplete = mutationRecords.at(0)?.addedNodes.item(0);

            if (isConnected() && addedAwesomplete && addedAwesomplete.classList.contains("awesomplete")) {
                addedAwesomplete.style.display = "none";
                answerInputContainer.prepend(answerInput);
            }

            mutationObserver.disconnect();
        });

        setupInputContainerObserver.observe(answerInputContainer, {childList: true})
    }

    // Song Info Box Setup
    const qpInfoHider = document.getElementById("qpInfoHider");
    qpInfoHider.style.display = "none";

    const qpSongName = document.getElementById("qpSongName");
    qpSongName.style.display = "none";
    qpSongName.parentElement.appendChild(songNameEl);

    const qpSongArtist = document.getElementById("qpSongArtist");
    qpSongArtist.style.display = "none";
    qpSongArtist.parentElement.appendChild(artistNameEl);

    qpSongArtist.previousElementSibling.appendChild(artistGroupInfoIconEl);
    qpSongArtist.previousElementSibling.appendChild(artistGroupInfoContentEl);

    qpSongName.previousElementSibling.appendChild(songMetadataInfoIconEl);
    qpSongName.previousElementSibling.appendChild(songMetadataInfoContentEl);

    $(artistGroupInfoIconEl).popover({
        html: true,
        content: () => {
            return $(artistGroupInfoContentEl).html();
        },
        trigger: "hover focus",
        delay: {
            show: 150,
            hide: 50
        },
        placement: "bottom"
    });

    $(songMetadataInfoIconEl).popover({
        html: true,
        content: () => {
            return $(songMetadataInfoContentEl).html();
        },
        trigger: "hover focus",
        delay: {
            show: 150,
            hide: 50
        },
        placement: "bottom"
    });

    // Replaced answer input setup
    answerInput.addEventListener('input', onAnswerInput);
    answerInput.addEventListener('keydown', onAnswerKeydown)

    const gcInput = document.getElementById("gcInput");
    gcInput.addEventListener("keydown", onGameChatKeydown);

    // Noop original callbacks
    quiz._playerAnswerListener.callback = () => {
    };
    quiz._teamMemberAnswerListener.callback = () => {
    };

    css.disabled = false;

    lobby.viewSettings = () => {
        hostModal.setModeGameSettings(true, false);
        hostModal.showSettings();
        hostModal.show();
    };

    lobby.changeGameSettings = async () => {
        const modalSettings = hostModal.getSettings();

        const changes = Object.keys(modalSettings).reduce((obj, key) => {
            const modalValue = modalSettings[key];
            const lobbyValue = lobby.settings[key];

            if (JSON.stringify(modalValue) === JSON.stringify(lobbyValue)) {
                return obj;
            }

            return {
                ...obj,
                [key]: modalValue,
            };
        }, {});

        await signalRConnection.invoke("ChangeRoomSettings", changes);

        hostModal.hide();
    };

    const titleId = "qpSongArtistTitle";
    const elements = document.getElementById(titleId).parentElement.children;
    for (let i = elements.length - 1; i >= 0; --i) {
        const el = elements[i];
        if (el.id === titleId) {
            el.style.marginLeft = "0px";
            continue;
        }
        el.style.display = "none";
    }

    setupInstalled = true;
}

function removeIntegration() {
    if (!setupInstalled) {
        return;
    }

    console.log("removeIntegration");

    setConnectionStatus(CONNECTION_STATE.OFFLINE);

    const gamePage = document.getElementById("gameChatPage").firstElementChild;

    if (gamePage.contains(integrationDiv)) {
        gamePage.removeChild(integrationDiv);
    }

    // Restore original answer input
    const answerInputContainer = document.getElementById("qpAnswerInputContainer");

    answerInputContainerObserver.disconnect();

    if (setupInputContainerObserver) {
        setupInputContainerObserver.disconnect();
    }

    if (answerInputContainer.contains(answerInput)) {
        answerInputContainer.removeChild(answerInput);
    }

    const awesomplete = answerInputContainer.querySelector(".awesomplete");

    if (awesomplete) {
        awesomplete.style.display = "";
    }

    // Restore song info box
    const qpInfoHider = document.getElementById("qpInfoHider");
    qpInfoHider.style.display = "";

    const qpSongName = document.getElementById("qpSongName");
    qpSongName.parentElement.removeChild(songNameEl);
    qpSongName.style.display = "";

    const qpSongArtist = document.getElementById("qpSongArtist");
    qpSongArtist.parentElement.removeChild(artistNameEl);
    qpSongArtist.style.display = "";

    qpSongArtist.previousElementSibling.removeChild(artistGroupInfoIconEl);
    qpSongArtist.previousElementSibling.removeChild(artistGroupInfoContentEl);

    // Remove listeners on the input used as replacement
    answerInput.removeEventListener('input', onAnswerInput);
    answerInput.removeEventListener('keydown', onAnswerKeydown);

    // Restore original callbacks
    quiz._playerAnswerListener.callback = originalPlayerAnswerCallback;
    quiz._teamMemberAnswerListener.callback = originalTeamMemberAnswerCallback;

    removeOverride();

    const gcInput = document.getElementById("gcInput");
    gcInput.removeEventListener("keydown", onGameChatKeydown);

    css.disabled = true;

    lobby.viewSettings = originalLobbyViewSettings;
    lobby.changeGameSettings = originalChangeGameSettings;

    const titleId = "qpSongArtistTitle";
    const elements = document.getElementById(titleId).parentElement.children;
    for (let i = elements.length - 1; i >= 0; --i) {
        const el = elements[i];
        if (el.id === titleId) {
            el.style.marginLeft = null;
            continue;
        }
        el.style.display = null;
    }

    setupInstalled = false;
}

function setupOverride() {
    quiz._nextVideoInfoListener.callback = () => {};

    quiz._quizreadyListner.callback = function (data) {
        quiz.infoContainer.setTotalSongCount(data.numberOfSongs);
        quiz.infoContainer.setCurrentSongCount(0);
        setTimeout(() => {
            quizVideoController.loadNextVideo();
        }, 1000);
    };

    quiz._playerAnswerListner.callback = function (data) {
        quiz.videoTimerBar.updateState(data.progressBarState);
    };

    QuizInfoContainer.prototype.displayAnimeName = () => {};

    Object.defineProperty(QuizAvatarSlot.prototype, "listStatus", {
        set: () => {}
    });

    Object.defineProperty(QuizAvatarSlot.prototype, "listScore", {
        set: () => {}
    });

    songHistoryWindow.addNewSong = () => {};

    $("#qpSongType").parent().addClass("hidden");
}

function removeOverride() {
    quiz._nextVideoInfoListener.callback = originalNextVideoInfoCallback;
    quiz._quizreadyListner.callback = originalQuizReadyCallback;
    quiz._playerAnswerListner.callback = originalPlayerAnswersCallback;

    QuizInfoContainer.prototype.displayAnimeName = originalDisplayAnimeName;

    Object.defineProperty(QuizAvatarSlot.prototype, "listStatus", originalListStatus);

    Object.defineProperty(QuizAvatarSlot.prototype, "listScore", originalListScore);

    songHistoryWindow.addNewSong = originalAddNewSong;

    $("#qpSongType").parent().removeClass("hidden");
}

/**
 * @param {string} videoId
 * @param {boolean} amqCatboxRedirect
 * @returns {string}
 */
function resolveVideoUrl(videoId, amqCatboxRedirect = false) {
    if (videoId.includes("catbox")) {
        const url = new URL(videoId);

        if (amqCatboxRedirect) {
            url.host = "amq.catbox.video";
        }

        return url.toString();
    }

    return `${CONFIG.fileServerUrl}/files/${videoId}`;
}

/**
 * @returns {boolean}
 */
function isConnected() {
    if (!signalRConnection) return false;

    return signalRConnection.state === signalR.HubConnectionState.Connected;
}

function setupConfigWindow() {
    configWindow = new AMQWindow({
        width: 400,
        height: 398,
        position: {
            x: 650,
            y: 320
        },
        title: "S/A Integration Config",
        draggable: true,
        zIndex: 1050
    });

    configWindow.addPanel({
        id: "sai-config",
        width: 1.0,
        height: "calc(100% - 10px)"
    });

    const currentUrlIndex = FILE_SERVER_URLS.findIndex(({ url }) => CONFIG.fileServerUrl === url);
    if (currentUrlIndex < 0) {
        CONFIG.fileServerUrl = DEFAULT_FILE_SERVER_URL;
        GM_setValue("fileServerUrl", DEFAULT_FILE_SERVER_URL);
    }

    let fileUrlSelect = $(`<select name="file-server-url-select" style="color: black;"></select>`);

    FILE_SERVER_URLS.forEach(({ name, url }) =>
        fileUrlSelect.append($(`<option value="${url}" ${CONFIG.fileServerUrl === url ? "selected=\"selected\"" : ""}>${name} (${url})</option>`)));

    fileUrlSelect.on("change", event => {
        const url = event.target.value;
        CONFIG.fileServerUrl = url;
        GM_setValue("fileServerUrl", url);
    });

    configWindow.panels[0].panel
        .append($(`<div class="sai-config-items"></div>`)
            .append($(`<div class="sai-checkbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='sai-auto-send' type='checkbox'>")
                        .prop("checked", CONFIG.autoSendAnswers)
                        .click(function () {
                            const checked = $(this).prop("checked");
                            CONFIG.autoSendAnswers = checked;
                            GM_setValue("autoSendAnswers", checked);
                        })
                    )
                    .append($("<label for='sai-auto-send'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Auto Send</label>")
                    .popover({
                        content: "Automatically submit answers as you type",
                        placement: "top",
                        trigger: "hover",
                        container: "body",
                        animation: false
                    })
                )
            )
            .append($(`<div class="sai-checkbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='sai-auto-skip-correct' type='checkbox'>")
                        .prop("checked", CONFIG.autoSkipWhenCorrect)
                        .click(function () {
                            const checked = $(this).prop("checked");
                            CONFIG.autoSkipWhenCorrect = checked;
                            GM_setValue("autoSkipWhenCorrect", checked);
                        })
                    )
                    .append($("<label for='sai-auto-skip-correct'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Auto Skip When Correct</label>")
                    .popover({
                        content: "Automatically send skip vote when song & artist is guessed",
                        placement: "top",
                        trigger: "hover",
                        container: "body",
                        animation: false
                    })
                )
            )
            .append($(`<div class="sai-checkbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='sai-auto-skip-undefined' type='checkbox'>")
                        .prop("checked", CONFIG.autoSkipWhenUndefined)
                        .click(function () {
                            const checked = $(this).prop("checked");
                            CONFIG.autoSkipWhenUndefined = checked;
                            GM_setValue("autoSkipWhenUndefined", checked);
                        })
                    )
                    .append($("<label for='sai-auto-skip-undefined'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Auto Skip When Undefined</label>")
                    .popover({
                        content: "Automatically send skip vote when song is undefined",
                        placement: "top",
                        trigger: "hover",
                        container: "body",
                        animation: false
                    })
                )
            )
            .append($(`<div class="sai-checkbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='sai-auto-skip-always' type='checkbox'>")
                        .prop("checked", CONFIG.autoSkipAlways)
                        .click(function () {
                            const checked = $(this).prop("checked");
                            CONFIG.autoSkipAlways = checked;
                            GM_setValue("autoSkipAlways", checked);
                        })
                    )
                    .append($("<label for='sai-auto-skip-always'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Auto Skip Always</label>")
                    .popover({
                        content: "Automatically send skip vote at the beginning of guess phase",
                        placement: "top",
                        trigger: "hover",
                        container: "body",
                        animation: false
                    })
                )
            )
            .append($(`<div class="sai-checkbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='sai-auto-skip-strings' type='checkbox'>")
                        .prop("checked", CONFIG.autoSkipStrings)
                        .click(function () {
                            const checked = $(this).prop("checked");
                            CONFIG.autoSkipStrings = checked;
                            GM_setValue("autoSkipStrings", checked);
                        })
                    )
                    .append($("<label for='sai-auto-skip-strings'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Auto Skip On Input</label>")
                    .popover({
                        content: "Automatically send skip vote when answering certain strings. Defined Strings: [\"" + AUTO_SKIP_STRINGS.join("\", \"") + "\"]",
                        placement: "top",
                        trigger: "hover",
                        container: "body",
                        animation: false
                    })
                )
            )
            .append($(`<div style="margin: 8px;"></div>`)
                .append($("<label>File Server Mirror</label>"))
                .append($(`<div style="display: flex; gap: 8px; margin-bottom: 6px;"></div>`)
                    .append(fileUrlSelect)
                )
            )
            .append($(`<div style="margin: 8px;"></div>`)
                .append($("<label>Custom List Name</label>"))
                .append($(`<div style="display: flex; gap: 8px; margin-bottom: 6px;"></div>`)
                    .append($(`<input id="list-name-input" class="form-control" type="text" placeholder="Enter custom list name">`)
                        .on("input", () => $("#list-sync-status").text(""))
                    )
                    .append($(`<button class="btn btn-primary">Update</button>`)
                        .click(updateCustomList)
                    )
                )
                .append($(`<span id="list-sync-status"></span>`))
            )
        );
}

function setup() {
    new Listener("Join Game", onJoinGame).bindListener();
    new Listener("Spectate Game", onSpectateGame).bindListener();
    new Listener("Host Game", onHostGame).bindListener();
    new Listener("Game Starting", onGameStart).bindListener();
    new Listener("guess phase over", onGuessPhaseOver).bindListener();
    new Listener("play next song", onPlayNextSong).bindListener();
    new Listener("nexus map init", onNexusMapInit).bindListener();
    new Listener("nexus map rejoin", onNexusMapRejoin).bindListener();
    new Listener("answer results", onAmqAnswerResults).bindListener();

    originalTeamMemberAnswerCallback = quiz._teamMemberAnswerListener.callback;
    originalPlayerAnswerCallback = quiz._playerAnswerListener.callback;

    originalNextVideoInfoCallback = quiz._nextVideoInfoListener.callback;
    originalQuizReadyCallback = quiz._quizreadyListner.callback;
    originalPlayerAnswersCallback = quiz._playerAnswerListner.callback;

    originalDisplayAnimeName = QuizInfoContainer.prototype.displayAnimeName;
    originalListStatus = Object.getOwnPropertyDescriptor(QuizAvatarSlot.prototype, "listStatus");
    originalListScore = Object.getOwnPropertyDescriptor(QuizAvatarSlot.prototype, "listScore");

    originalAddNewSong = songHistoryWindow.addNewSong;

    originalChangeGameSettings = lobby.changeGameSettings;
    originalLobbyViewSettings = lobby.viewSettings;

    ChatBox.prototype.writeMessage = (function (_super) {
        return function () {
            if (arguments[1].startsWith(messageHeaderString)) return;
            return _super.apply(this, arguments);
        }
    })(ChatBox.prototype.writeMessage);

    socket._socket.t.$command[0] = (function (_super) {
        return function () {
            if (arguments.length > 0 && arguments[0].command === 'chat message' && arguments[0].data.hasOwnProperty('message') && arguments[0].data.message.startsWith(messageHeaderString)) {
                const payload = arguments[0].data;

                const handshake = payload.message.substring(messageHeaderString.length, handshakeString.length + 1);

                if (handshake === handshakeString) {
                    amqSendPrivateMessage(payload.sender, `${messageHeaderString}${handshakeString}(OK)`);
                    return;
                }

                const message = payload.message.substring(messageHeaderString.length).split(':');

                if (message.length === 2) {
                    const [name, token] = message;
                    connectSignalR(token);
                }
                return;
            }
            return _super.apply(this, arguments);
        }
    })(socket._socket.t.$command[0]);

    songHistoryInfoWindow.displayInfo = (function (_super) {
        return function () {
            if (arguments[0].songInfo.isCustomSong) {
                this.$animeType.parent().hide();
                this.$type.parent().hide();
                this.$vintage.parent().hide();
                this.$tags.parent().hide();
                this.$animeRating.parent().hide();
                this.$difficulty.parent().hide();
                this.$mal.parent().parent().hide();
                this.$annId.parent().parent().hide();
                this.$englishTitle.parent().hide();
                this.$genre.prev().text("Album");
                this.$romajiTitle.prev().text("Group");
                this.$allWorkingTitlesContainer.prev().text("Groups");
            }
            else {
                this.$animeType.parent().show();
                this.$type.parent().show();
                this.$vintage.parent().show();
                this.$genre.parent().show();
                this.$tags.parent().show();
                this.$animeRating.parent().show();
                this.$difficulty.parent().show();
                this.$mal.parent().parent().show();
                this.$annId.parent().parent().show();
                this.$englishTitle.parent().show();
                this.$genre.prev().text("Genres");
                this.$romajiTitle.prev().text("Anime Romaji");
                this.$allWorkingTitlesContainer.prev().text("All Working Titles");
            }
            return _super.apply(this, arguments);
        }
    })(songHistoryInfoWindow.displayInfo);

    setupConfigWindow();
}

function onPlayNextSong(data) {
    if (!quiz || !isConnected()) {
        return;
    }

    if (quiz.isSpectator) {
        return;
    }

    answerInput.style.color = "";
    answerInput.value = "";
    answerInput.disabled = false;

    if (answerInput.parentElement.classList.contains("focused")) {
        answerInput.focus();
    }

    if (CONFIG.autoSkipAlways) {
        amqVoteSkip(true);
    }
}

function onGuessPhaseOver(data) {
    answerInput.disabled = true;
    botAnswerResults = null;
    amqAnswerResults = null;
    
    disableGuessRoles(true, true);
}

function onGameStart(data) {
    answerInput.value = "";
    answerInput.disabled = true;

    resetSongInfo();

    ngm.active = false;

    csRigCounter = {};
}

function onAmqAnswerResults(data) {
    if (botAnswerResults !== null) {
        onCombinedAnswerResults(data, botAnswerResults);
    }
    else {
        amqAnswerResults = data;
    }
}

function onJoinGame(data) {
    csRigCounter = {};
    removeIntegration();
}

function onSpectateGame(data) {
    csRigCounter = {};
    removeIntegration();
}

function onHostGame(data) {
    removeIntegration();
}

function onNexusMapInit(data) {
    removeIntegration();
}

function onNexusMapRejoin(data) {
    removeIntegration();
}

function init() {
    if (!window.quiz) {
        setTimeout(init, 500);
        return;
    }

    const loadingScreen = document.getElementById('loadingScreen');

    if (!loadingScreen) {
        setup();
        return;
    }

    new MutationObserver((mutationRecord, mutationObserver) => {
        setup();
        mutationObserver.disconnect();
    }).observe(loadingScreen, { attributes: true });
}

(function (window) {
    init();
})(unsafeWindow.window);
