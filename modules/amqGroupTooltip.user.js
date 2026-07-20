// ==UserScript==
// @name         AMQ Group Tooltip
// @namespace    https://animemusicquiz.com/
// @version      2.2.0
// @description  Captures AMQ group tooltips, compares versions against a base JSON, auto-fills song names, and stores compact versions with songs
// @match        https://*.animemusicquiz.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      codeberg.org
// @connect      files.catbox.moe
// ==/UserScript==

(() => {
    'use strict';

    const PANEL_ID = 'amq-version-capture-panel';
    const BODY_ID = 'amq-version-capture-body';
    const STATUS_ID = 'amq-version-capture-status';
    const OUTPUT_ID = 'amq-version-capture-output';
    const CAPTURED_ID = 'amq-version-capture-captured';
    const MISSING_OUTPUT_ID = 'amq-version-capture-missing-output';
    const MISSING_BODY_ID = 'amq-version-capture-missing-body';
    const MISSING_STORAGE_KEY = 'amq-version-capture-missing-store-v1';
    const MISSING_MINIMIZED_KEY = 'amq-version-capture-missing-minimized-v1';
    const OUTPUT_TOOLS_KEY = 'amq-version-capture-output-tools-v1';
    const MISSING_TOOLS_KEY = 'amq-version-capture-missing-tools-v1';
    const STORAGE_KEY = 'amq-version-capture-store-v2';
    const PANEL_MINIMIZED_KEY = 'amq-version-capture-minimized-v2';
    const MANUAL_VISIBLE_KEY = 'amq-version-capture-manual-visible-v1';
    const LANG_KEY = 'amq-version-capture-lang-v1';
    const OUTPUT_MINIMIZED_KEY = 'amq-version-capture-output-minimized-v1';
    const CODEBERG_MINIMIZED_KEY = 'amq-version-capture-codeberg-minimized-v1';
    const OUTPUT_BODY_ID = 'amq-version-capture-output-body';

    let missingStore = loadMissingStore();
    let missingMinimized = localStorage.getItem(MISSING_MINIMIZED_KEY) === '1';
    let outputToolsOpen = localStorage.getItem(OUTPUT_TOOLS_KEY) === '1';
    let missingToolsOpen = localStorage.getItem(MISSING_TOOLS_KEY) === '1';

    let capturedStore = {};
    let capturedVersionIndex = new Map();
    let capturedLoaded = false;
    let capturedRawData = null;

    const BASE_GROUPS_URL = 'https://codeberg.org/liferoge/databases/raw/branch/main/groups.json';
    const CAPTURED_JSON_URL = 'https://codeberg.org/liferoge/databases/raw/branch/main/groupversions.json';
    const TRANSLATION_EN_URL = 'https://codeberg.org/liferoge/databases/raw/branch/main/amqgrouptooltip.en.json';
    const SONG_DB_URL = 'https://files.catbox.moe/4d1ikt.json';

const FIXED_CODEBERG_TOKEN = '32e5e5239f9e30af84841b75b2e3842e41b5808d';
const FIXED_CODEBERG_TARGET = 'https://codeberg.org/liferoge/databases/src/branch/main/groupversions.json';
const FIXED_CODEBERG_GROUPS_TARGET = 'https://codeberg.org/liferoge/databases/src/branch/main/groups.json';

let codebergToken = FIXED_CODEBERG_TOKEN;
let codebergTarget = FIXED_CODEBERG_TARGET;
let codebergGroupsTarget = FIXED_CODEBERG_GROUPS_TARGET;

let manualVisible = localStorage.getItem(MANUAL_VISIBLE_KEY) === '1';
const PANEL_POSITION_KEY = 'amq-version-capture-position-v1';

let panelPosition = loadPanelPosition();

let outputMinimized = localStorage.getItem(OUTPUT_MINIMIZED_KEY) === '1';

let uiLang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'pt';

let enStrings = null;
let lastStatusRawMessage = '';

function setLanguage(lang) {
    uiLang = lang === 'en' ? 'en' : 'pt';
    localStorage.setItem(LANG_KEY, uiLang);
}

async function loadEnglishPack() {
    if (uiLang !== 'en') return null;
    if (enStrings) return enStrings;

    enStrings = await loadJson(TRANSLATION_EN_URL);
    if (!enStrings || typeof enStrings !== 'object') enStrings = {};
    return enStrings;
}

function tr(path, fallback) {
    if (uiLang !== 'en') return fallback;

    const value = path.split('.').reduce((obj, key) => {
        if (!obj || typeof obj !== 'object') return undefined;
        return obj[key];
    }, enStrings || {});

    return typeof value === 'string' && value.trim() ? value : fallback;
}

function translateStatus(raw) {
    const text = String(raw || '');
    if (uiLang !== 'en') return text;
        let m;

    const exactMap = {
        'JSON copiado para a área de transferência.': 'status.jsonCopied',
        'Limpo. Aguardando tooltip...': 'status.clearedWaitingTooltip',
        'Limpo. Carregando bases...': 'status.clearedLoadingBases',
        'Grupos fora da base copiado.': 'status.missingCopied',
        'Saída de grupos fora da base limpa.': 'status.missingCleared',
        'Bases carregadas. Aguardando tooltip...': 'status.baseLoaded',
        'Falha ao carregar uma das bases, mas o painel foi iniciado.': 'status.startupFailed',
        'Saída atual salva localmente.': 'status.saveOutputLocal',
        'Grupos fora da base salvos localmente.': 'status.saveMissingLocal',
        'JSON inválido nessa saída.': 'status.invalidOutputJson',
        'Digite um texto para pesquisar.': 'status.enterTextSearch',
        'Digite o grupo.': 'status.manualMissingGroup',
        'Digite ao menos um membro.': 'status.manualMissingMember',
        'Configure o token do Codeberg para publicar.': 'status.configureToken',
        'Configure o caminho do arquivo para publicar.': 'status.configurePath',
        'Configure o caminho do groups.json para publicar.': 'status.configureGroupsPath',
        'JSON vazio. Nada para publicar.': 'status.emptyJson',
        'JSON de grupos fora da base vazio. Nada para publicar.': 'status.missingJsonEmpty',
        'JSON inválido na seção de grupos fora da base.': 'status.missingJsonInvalid',
        'Falha ao interpretar o groups.json remoto.': 'status.remoteJsonParseFailed',
        'Comparação falhou: tooltip não corresponde à música atual. Campos preenchidos automaticamente.': 'status.comparisonFailed',
        'Tooltip detectado: SongDB não encontrou a música atual; preencha o nome da música manualmente.': 'status.songDbMissing',
        'Tooltip identificado: artista já existe na base.': 'status.tooltipArtistExists',
        'Tooltip detectado: artista salvo fora da base.': 'status.tooltipArtistSavedOutsideBase',
        'Tooltip detectado: collab fora da base; campos preenchidos automaticamente.': 'status.tooltipCollabAutoFill',
        'Tooltip detectado: grupo salvo em JSON separado.': 'status.tooltipGroupSavedOutsideBase',
        'Tooltip detectado: collab ignorada pela regra atual.': 'status.tooltipCollabIgnored',
        'Tooltip identificado: versão já existe na base.': 'status.tooltipVersionExists'
    };

    if (exactMap[text]) return tr(exactMap[text], text);
    
        const namedTooltip = (key, fallback, name) => {
        const t = tr(key, fallback);
        const i = t.indexOf(': ');
        return i >= 0 ? `${t.slice(0, i + 1)} ${name}. ${t.slice(i + 2)}` : `${name}. ${t}`;
    };

    if ((m = text.match(/^Comparação falhou: tooltip \((.+)\) ≠ música atual \((.+)\)\. Campos preenchidos automaticamente\.$/))) {
        return tr('status.comparisonFailed', 'Comparison failed: tooltip does not match current song. Fields filled automatically.')
            .replace('tooltip does not match current song', `tooltip (${m[1]}) ≠ current song (${m[2]})`);
    }

    if ((m = text.match(/^Tooltip identificado: (.+?)\. Artista já existe na base\.$/))) {
        return namedTooltip('status.tooltipArtistExists', 'Tooltip identified: artist already exists in the base.', m[1]);
    }

    if ((m = text.match(/^Tooltip detectado: (.+?)\. Artista salvo fora da base\.$/))) {
        return namedTooltip('status.tooltipArtistSavedOutsideBase', 'Tooltip detected: artist saved outside the base.', m[1]);
    }

    if ((m = text.match(/^Tooltip detectado: (.+?)\. Collab fora da base; campos preenchidos automaticamente\.$/))) {
        return namedTooltip('status.tooltipCollabAutoFill', 'Tooltip detected: collab outside the base; fields filled automatically.', m[1]);
    }

    if ((m = text.match(/^Tooltip detectado: (.+?)\. Grupo fora da base salvo em JSON separado\.$/))) {
        return namedTooltip('status.tooltipGroupSavedOutsideBase', 'Tooltip detected: group saved in separate JSON.', m[1]);
    }

    if ((m = text.match(/^Tooltip detectado: (.+?)\. Collab ignorada pela regra atual\.$/))) {
        return namedTooltip('status.tooltipCollabIgnored', 'Tooltip detected: collab ignored by the current rule.', m[1]);
    }

    if ((m = text.match(/^Tooltip identificado: (.+?)\. Versão já existe na base\.$/))) {
        return namedTooltip('status.tooltipVersionExists', 'Tooltip identified: version already exists in the base.', m[1]);
    }

    if ((m = text.match(/^Tooltip detectado: (.+?)\. SongDB não encontrou a música atual; preencha o nome da música manualmente\.$/))) {
        return namedTooltip('status.songDbMissing', 'Tooltip detected: SongDB did not find the current song; enter the song name manually.', m[1]);
    }

    if ((m = text.match(/^Ignorado: (.+) \/ (.+) já tem essa versão na base\.$/))) {
        return `${m[1]} / ${m[2]} ${tr('status.manualDuplicateVersion', 'Ignored: already has this version in the base.').replace(/^Ignored:\s*/, '')}`;
    }
    
    if ((m = text.match(/^“(.+)” não encontrado\.$/)) || (m = text.match(/^"(.+)" não encontrado\.$/))) {
        return `"${m[1]}" ${tr('status.notFound', 'not found.')}`;
    }

        if ((m = text.match(/^Falha ao ler o arquivo no Codeberg \((.+)\)\.$/))) {
        return `${tr('status.readFileFailed', 'Failed to read the file on Codeberg.')} (${m[1]}).`;
    }
    if ((m = text.match(/^Falha ao publicar no Codeberg \((.+)\)\.$/))) {
        return `${tr('status.publishFailed', 'Failed to publish on Codeberg.')} (${m[1]}).`;
    }
    if ((m = text.match(/^Falha ao ler o groups\.json no Codeberg \((.+)\)\.$/))) {
        return `${tr('status.readFileFailed', 'Failed to read the file on Codeberg.')} (${m[1]}).`;
    }
    if ((m = text.match(/^Falha ao publicar o groups\.json \((.+)\)\.$/))) {
        return `${tr('status.publishGroupsFailed', 'Failed to publish groups.json.')} (${m[1]}).`;
    }
    if ((m = text.match(/^Publicado no Codeberg: (.+)$/))) {
        return `${tr('status.published', 'Published on Codeberg:')} ${m[1]}`;
    }
    if ((m = text.match(/^Grupo fora da base salvo em JSON separado: (.+)$/))) {
        return `${tr('status.manualMissingBaseSaved', 'Group outside base saved in separate JSON:')} ${m[1]}`;
    }
    if ((m = text.match(/^Versão salva manualmente: (.+)$/))) {
        return `${tr('status.manualSaved', 'Version saved manually:')} ${m[1]}`;
    }
    if ((m = text.match(/^Salvo com sucesso: (.+) \/ (.+)\.$/))) {
        return `${tr('status.savedSuccess', 'Saved successfully:')} ${m[1]} / ${m[2]}.`;
    }
    if ((m = text.match(/^Música adicionada na versão existente: (.+) \/ (.+)\.$/))) {
        return `${tr('status.songAddedExistingVersion', 'Song added to existing version:')} ${m[1]} / ${m[2]}.`;
    }
        if ((m = text.match(/^Ignorado: (.+) já tem essa versão na base\.$/))) {
        return `${m[1]} ${tr('status.alreadyExists', 'already exists.').replace(/^Ignored:\s*/, '')}`;
    }
    if ((m = text.match(/^Ignorado: (.+) \/ (.+) já existe\.$/))) {
        return `${m[1]} / ${m[2]} ${tr('status.alreadyExists', 'already exists.').replace(/^Ignored:\s*/, '')}`;
    }

    return text;
}

function loadPanelPosition() {
    try {
        const raw = localStorage.getItem(PANEL_POSITION_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (
            !parsed ||
            typeof parsed.left !== 'number' ||
            typeof parsed.top !== 'number'
        ) return null;

        return parsed;
    } catch {
        return null;
    }
}

function savePanelPosition(left, top) {
    try {
        localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({ left, top }));
    } catch {
        // ignore
    }
}

function applyPanelPosition(panel = document.getElementById(PANEL_ID)) {
    if (!panel) return;

    if (panelPosition) {
        panel.style.left = `${panelPosition.left}px`;
        panel.style.top = `${panelPosition.top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    } else {
        panel.style.left = 'auto';
        panel.style.top = 'auto';
        panel.style.right = '16px';
        panel.style.bottom = '16px';
    }
}

function bindPanelDrag(panel) {
    const header = panel.querySelector('.amq-header');
    if (!header) return;

    header.style.touchAction = 'none';

    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const onMove = e => {
        if (!dragging || e.pointerId !== pointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);

        const left = clamp(startLeft + dx, 8, maxLeft);
        const top = clamp(startTop + dy, 8, maxTop);

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    };

    const finish = e => {
        if (!dragging || e.pointerId !== pointerId) return;

        dragging = false;

        try {
            header.releasePointerCapture(pointerId);
        } catch {
            // ignore
        }

        const left = Number.parseInt(panel.style.left, 10);
        const top = Number.parseInt(panel.style.top, 10);

        if (Number.isFinite(left) && Number.isFinite(top)) {
            panelPosition = { left, top };
            savePanelPosition(left, top);
        }

        header.removeEventListener('pointermove', onMove);
        header.removeEventListener('pointerup', finish);
        header.removeEventListener('pointercancel', finish);
    };

    header.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest('button, select, input, textarea, option, label')) return;

        dragging = true;
        pointerId = e.pointerId;

        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        panel.style.left = `${startLeft}px`;
        panel.style.top = `${startTop}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        try {
            header.setPointerCapture(pointerId);
        } catch {
            // ignore
        }

        header.addEventListener('pointermove', onMove);
        header.addEventListener('pointerup', finish);
        header.addEventListener('pointercancel', finish);

        e.preventDefault();
    });
}

    const TOOLTIP_SELECTOR = [
        '[role="tooltip"]',
        '[aria-label*="tooltip" i]',
        '[class*="tooltip" i]',
        '[class*="Tooltip" i]',
        '.tooltip',
        '.Tooltip'
    ].join(',');

    let baseGroups = {};
    let baseVersionIndex = new Map();
    let songDb = {};
    let store = loadStore();
    let panelMinimized = localStorage.getItem(PANEL_MINIMIZED_KEY) === '1';

    let baseLoaded = false;
    let songsLoaded = false;

    let scanScheduled = false;
    let flushTimer = null;
    let lastStatusMessage = '';
    const pendingRoots = new Set();
    const recentCaptureTimes = new Map();

    function loadStore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

            const normalized = {};
            for (const [group, value] of Object.entries(parsed)) {
                if (Array.isArray(value)) {
                    normalized[group] = normalizeGroupStore(value);
                } else if (value && typeof value === 'object') {
                    normalized[group] = normalizeGroupStore([value]);
                }
            }
            return normalized;
        } catch {
            return {};
        }
    }

    function normalizeGroupStore(value) {
        if (!Array.isArray(value)) return [];

        const looksLikeLegacyFlatMembers = value.length > 0
        && value.every(item => Array.isArray(item) && item.length === 1 && typeof item[0] === 'string');

        if (looksLikeLegacyFlatMembers) {
            return [{
                members: value.map(item => [cleanTooltipMemberName(item[0])]).filter(item => item[0]),
                songs: []
            }];
        }

        return value
            .map(item => normalizeVersionRecord(item))
            .filter(Boolean);
    }

    function normalizeVersionRecord(record) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return null;

        const members = Array.isArray(record.members)
        ? record.members.map(item => Array.isArray(item) ? item : [item])
        : [];

        const cleanMembers = members
        .map(item => [cleanTooltipMemberName(item[0])])
        .filter(item => item[0]);

        const songs = Array.isArray(record.songs)
        ? [...new Set(record.songs.map(cleanSongName).filter(Boolean))]
        : [];

        return { members: cleanMembers, songs };
    }

    function saveStore() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch {
            // ignore
        }
    }

    function normalizeLoose(text) {
    return canonicalizeMemberText(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
    
    function canonicalizeMemberText(text) {
    return (text || '')
        .toString()
        .replace(/\u00a0/g, ' ')
        .replace(/[\u200B-\u200F\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

    function cleanMemberName(text) {
    return canonicalizeMemberText(text);
}
    
    function cleanTooltipMemberName(text) {
    return canonicalizeMemberText(text)
        .replace(/\([^()]*\)/g, ' ')
        .replace(/\sfrom\s.+$/i, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

    function cleanSongName(text) {
        return cleanMemberName(text);
    }

    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function normalizeText(text) {
        return (text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\r/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function collectTextWithBreaks(node) {
        const out = [];

        function walk(n) {
            if (!n) return;

            if (n.nodeType === Node.TEXT_NODE) {
                const text = n.nodeValue ? n.nodeValue.replace(/\u00a0/g, ' ').trim() : '';
                if (text) out.push(text);
                return;
            }

            if (n.nodeType !== Node.ELEMENT_NODE) return;

            const tag = n.tagName ? n.tagName.toUpperCase() : '';
            const style = getComputedStyle(n);
            const isBlock = tag === 'BR' || style.display === 'block' || style.display === 'table-row' || style.display === 'list-item';

            if (tag === 'BR') {
                out.push('\n');
                return;
            }

            if (isBlock && out.length && out[out.length - 1] !== '\n') {
                out.push('\n');
            }

            for (const child of n.childNodes) walk(child);

            if (isBlock && out.length && out[out.length - 1] !== '\n') {
                out.push('\n');
            }
        }

        walk(node);

        return out
            .join(' ')
            .replace(/[ \t]*\n[ \t]*/g, '\n')
            .replace(/\n{2,}/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }

    function ensurePanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
        <div class="amq-header">
    <strong>AMQ Group Tooltip</strong>
    <div class="amq-actions">
        <select id="amq-lang-select" class="amq-lang-select" aria-label="Idioma" title="Idioma">
            <option value="pt">PT</option>
            <option value="en">EN</option>
        </select>
        <button type="button" id="amq-toggle-btn">Minimizar</button>
    </div>
</div>

        <div id="${BODY_ID}" class="amq-body">
            <div class="amq-manual-toggle-row">
                <button type="button" id="amq-manual-toggle-btn">Mostrar campos manuais</button>
            </div>

            <div id="amq-manual-wrap" class="amq-manual">
                <div class="amq-manual-row">
                    <label for="amq-manual-group">Grupo / artista</label>
                    <input id="amq-manual-group" type="text" autocomplete="off" spellcheck="false" />
                </div>

                <div class="amq-manual-row">
                    <label for="amq-manual-members">Membros</label>
                    <textarea id="amq-manual-members" spellcheck="false" placeholder="Separados por linha"></textarea>
                </div>

                <div class="amq-manual-row">
                    <label for="amq-manual-song">Música</label>
                    <input id="amq-manual-song" type="text" autocomplete="off" spellcheck="false" />
                </div>

                <button type="button" id="amq-manual-save-btn">Salvar versão</button>
            </div>

                        <div id="${STATUS_ID}" class="amq-status">Carregando bases...</div>

            <div class="amq-section-head" style="display:none">
    <div class="amq-section-label">Codeberg</div>
    <div class="amq-actions">
        <button type="button" id="amq-codeberg-toggle-btn">Minimizar</button>
    </div>
</div>

<div id="amq-codeberg-body" style="display:none">
</div>

            <div class="amq-section-head">
    <div class="amq-section-label">Saída atual</div>
    <div class="amq-actions">
        <button type="button" id="amq-output-minimize-btn">Minimizar</button>
        <button type="button" id="amq-copy-btn">Copiar</button>
        <button type="button" id="amq-clear-btn">Limpar</button>
    </div>
    <button type="button" id="amq-output-toggle-btn" class="amq-lens-btn" aria-label="Pesquisar/editar saída atual">🔍</button>
</div>

<div id="${OUTPUT_BODY_ID}">
    <div id="amq-output-tools" class="amq-tools">
        <input id="amq-output-search" type="text" spellcheck="false" placeholder="Pesquisar no JSON..." />
        <button type="button" id="amq-output-find-btn">Buscar</button>
        <button type="button" id="amq-output-apply-btn">Aplicar</button>
    </div>

    <textarea id="${OUTPUT_ID}" spellcheck="false"></textarea>
</div>

            <div class="amq-section-head">
    <div class="amq-section-label">Grupos fora da base</div>

    <div class="amq-actions">
        <button type="button" id="amq-missing-toggle-btn">Minimizar</button>
        <button type="button" id="amq-missing-copy-btn">Copiar</button>
        <button type="button" id="amq-missing-clear-btn">Limpar</button>
    </div>

    <button type="button" id="amq-missing-tools-toggle-btn" class="amq-lens-btn" aria-label="Pesquisar/editar grupos fora da base">🔍</button>
</div>

            <div id="amq-missing-tools" class="amq-tools">
    <input id="amq-missing-search" type="text" spellcheck="false" placeholder="Pesquisar no JSON..." />
    <button type="button" id="amq-missing-find-btn">Buscar</button>
    <button type="button" id="amq-missing-apply-btn">Aplicar</button>
</div>

<div id="${MISSING_BODY_ID}" class="amq-missing">
    <textarea id="${MISSING_OUTPUT_ID}" spellcheck="false"></textarea>
</div>
    `;

    document.body.appendChild(panel);
        const langSelect = document.getElementById('amq-lang-select');
    if (langSelect) {
        langSelect.value = uiLang;
        langSelect.addEventListener('change', async () => {
            setLanguage(langSelect.value);
            await loadEnglishPack();
            applyLocalizedTexts();
            if (lastStatusRawMessage) setStatus(lastStatusRawMessage);
        });
    }

    bindPanelDrag(panel);
    applyPanelPosition(panel);

    document.getElementById('amq-toggle-btn').addEventListener('click', () => {
        panelMinimized = !panelMinimized;
        localStorage.setItem(PANEL_MINIMIZED_KEY, panelMinimized ? '1' : '0');
        applyPanelState();
    });

        document.getElementById('amq-copy-btn').addEventListener('click', async () => {
    if (hasCodebergPublishConfig()) {
        if (codebergTarget) {
            await publishOutputToCodeberg();
        }

        if (codebergGroupsTarget) {
            await publishMissingToCodeberg();
        }
        return;
    }

    const out = document.getElementById(OUTPUT_ID);
    if (!out || !out.value.trim()) return;

    try {
        await navigator.clipboard.writeText(out.value);
        setStatus('JSON copiado para a área de transferência.');
    } catch {
        out.focus();
        out.select();
        document.execCommand('copy');
        setStatus('JSON copiado para a área de transferência.');
    }
});

    document.getElementById('amq-clear-btn').addEventListener('click', () => {
        store = {};
        saveStore();
        refreshOutput();
        setStatus(baseLoaded && songsLoaded ? 'Limpo. Aguardando tooltip...' : 'Limpo. Carregando bases...');
    });

    document.getElementById('amq-output-toggle-btn').addEventListener('click', () => {
        outputToolsOpen = !outputToolsOpen;
        localStorage.setItem(OUTPUT_TOOLS_KEY, outputToolsOpen ? '1' : '0');
        applyOutputToolsState();
    });
    
    document.getElementById('amq-output-minimize-btn').addEventListener('click', () => {
    outputMinimized = !outputMinimized;
    localStorage.setItem(OUTPUT_MINIMIZED_KEY, outputMinimized ? '1' : '0');
    applyOutputState();
});

    document.getElementById('amq-output-find-btn').addEventListener('click', () => {
        searchInOutput('main');
    });

    document.getElementById('amq-output-apply-btn').addEventListener('click', () => {
        saveEditableJson('main');
    });

    document.getElementById('amq-output-search').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchInOutput('main');
        }
    });

    document.getElementById('amq-missing-toggle-btn').addEventListener('click', () => {
        missingMinimized = !missingMinimized;
        localStorage.setItem(MISSING_MINIMIZED_KEY, missingMinimized ? '1' : '0');
        applyMissingState();
    });

    document.getElementById('amq-missing-copy-btn').addEventListener('click', async () => {
        const out = document.getElementById(MISSING_OUTPUT_ID);
        if (!out || !out.value.trim()) return;

        try {
            await navigator.clipboard.writeText(out.value);
            setStatus('Grupos fora da base copiado.');
        } catch {
            out.focus();
            out.select();
            document.execCommand('copy');
            setStatus('Grupos fora da base copiado.');
        }
    });

    document.getElementById('amq-missing-clear-btn').addEventListener('click', () => {
        missingStore = {};
        saveMissingStore();
        refreshMissingOutput();
        setStatus('Saída de grupos fora da base limpa.');
    });

    document.getElementById('amq-missing-tools-toggle-btn').addEventListener('click', () => {
        missingToolsOpen = !missingToolsOpen;
        localStorage.setItem(MISSING_TOOLS_KEY, missingToolsOpen ? '1' : '0');
        applyMissingToolsState();
    });

    document.getElementById('amq-missing-find-btn').addEventListener('click', () => {
        searchInOutput('missing');
    });

    document.getElementById('amq-missing-apply-btn').addEventListener('click', () => {
        saveEditableJson('missing');
    });

    document.getElementById('amq-missing-search').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchInOutput('missing');
        }
    });

    document.getElementById('amq-manual-save-btn').addEventListener('click', () => {
        handleManualSave();
    });

    document.getElementById('amq-manual-toggle-btn').addEventListener('click', () => {
        manualVisible = !manualVisible;
        localStorage.setItem(MANUAL_VISIBLE_KEY, manualVisible ? '1' : '0');
        applyManualState();
    });

applyManualState();
refreshMissingOutput();
applyMissingToolsState();
applyOutputToolsState();
applyPanelState();
applyOutputState();
}

    function applyPanelState() {
    const body = document.getElementById(BODY_ID);
    const toggle = document.getElementById('amq-toggle-btn');
    const copyBtn = document.getElementById('amq-copy-btn');
    const clearBtn = document.getElementById('amq-clear-btn');
    const panel = document.getElementById(PANEL_ID);

    if (!body || !toggle || !panel) return;

    body.style.display = panelMinimized ? 'none' : '';
    toggle.textContent = panelMinimized ? tr('panel.expand', 'Expandir') : tr('panel.minimize', 'Minimizar');

    if (copyBtn) copyBtn.style.display = panelMinimized ? 'none' : '';
    if (clearBtn) clearBtn.style.display = panelMinimized ? 'none' : '';
    panel.classList.toggle('is-minimized', panelMinimized);
}

    function sendStatusToGameChat(message) {
    try {
        if (typeof gameChat !== 'undefined' && gameChat && gameChat.open && typeof gameChat.systemMessage === 'function') {
            gameChat.systemMessage(String(message));
            return;
        }

        if (typeof nexus !== 'undefined' && nexus && nexus.inCoopLobby &&
            typeof nexusCoopChat !== 'undefined' && nexusCoopChat &&
            typeof nexusCoopChat.displayServerMessage === 'function') {
            nexusCoopChat.displayServerMessage({ message: String(message) });
        }
    } catch {
        // não interrompe o script se o chat não estiver disponível
    }
}

function setStatus(message) {
    const raw = String(message || '');
    const text = translateStatus(raw);

    const el = document.getElementById(STATUS_ID);
    if (el) el.textContent = text;

    if (raw === lastStatusRawMessage && text === lastStatusMessage) return;
    lastStatusRawMessage = raw;
    lastStatusMessage = text;

    sendStatusToGameChat(text);
}

function applyLocalizedTexts() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const langSelect = document.getElementById('amq-lang-select');
    if (langSelect) langSelect.value = uiLang;

    const title = panel.querySelector('.amq-header strong');
    if (title) title.textContent = tr('panel.title', 'AMQ Group Tooltip');

    const mainToggle = document.getElementById('amq-toggle-btn');
    if (mainToggle) mainToggle.textContent = panelMinimized ? tr('panel.expand', 'Expandir') : tr('panel.minimize', 'Minimizar');

    const manualToggle = document.getElementById('amq-manual-toggle-btn');
    if (manualToggle) manualToggle.textContent = manualVisible ? tr('manual.toggleHide', 'Ocultar campos manuais') : tr('manual.toggleShow', 'Mostrar campos manuais');

    const groupLabel = panel.querySelector('label[for="amq-manual-group"]');
    if (groupLabel) groupLabel.textContent = tr('manual.groupLabel', 'Grupo / artista');

    const membersLabel = panel.querySelector('label[for="amq-manual-members"]');
    if (membersLabel) membersLabel.textContent = tr('manual.membersLabel', 'Membros');

    const songLabel = panel.querySelector('label[for="amq-manual-song"]');
    if (songLabel) songLabel.textContent = tr('manual.songLabel', 'Música');

    const membersInput = document.getElementById('amq-manual-members');
    if (membersInput) membersInput.placeholder = tr('manual.membersPlaceholder', 'Separados por linha');

    const manualSave = document.getElementById('amq-manual-save-btn');
    if (manualSave) manualSave.textContent = tr('manual.saveButton', 'Salvar versão');

    const sectionLabels = panel.querySelectorAll('.amq-section-label');
    if (sectionLabels[0]) sectionLabels[0].textContent = tr('sections.codeberg', 'Codeberg');
    if (sectionLabels[1]) sectionLabels[1].textContent = tr('sections.currentOutput', 'Saída atual');
    if (sectionLabels[2]) sectionLabels[2].textContent = tr('sections.groupsOutsideBase', 'Grupos fora da base');

    const outToggle = document.getElementById('amq-output-toggle-btn');
    if (outToggle) outToggle.setAttribute('aria-label', tr('output.toggleAriaLabel', 'Pesquisar/editar saída atual'));

    const outSearch = document.getElementById('amq-output-search');
    if (outSearch) outSearch.placeholder = tr('output.searchPlaceholder', 'Pesquisar no JSON...');

    const outFind = document.getElementById('amq-output-find-btn');
    if (outFind) outFind.textContent = tr('output.findButton', 'Buscar');

    const outApply = document.getElementById('amq-output-apply-btn');
    if (outApply) outApply.textContent = tr('output.applyButton', 'Aplicar');

    const outClear = document.getElementById('amq-clear-btn');
    if (outClear) outClear.textContent = tr('output.clearButton', 'Limpar');

    const missingToggle = document.getElementById('amq-missing-tools-toggle-btn');
    if (missingToggle) missingToggle.setAttribute('aria-label', tr('missing.toggleAriaLabel', 'Pesquisar/editar grupos fora da base'));

    const missingSearch = document.getElementById('amq-missing-search');
    if (missingSearch) missingSearch.placeholder = tr('missing.searchPlaceholder', 'Pesquisar no JSON...');

    const missingFind = document.getElementById('amq-missing-find-btn');
    if (missingFind) missingFind.textContent = tr('missing.findButton', 'Buscar');

    const missingApply = document.getElementById('amq-missing-apply-btn');
    if (missingApply) missingApply.textContent = tr('missing.applyButton', 'Aplicar');

    const missingCopy = document.getElementById('amq-missing-copy-btn');
    if (missingCopy) missingCopy.textContent = tr('missing.copyButton', 'Copiar');

    const missingClear = document.getElementById('amq-missing-clear-btn');
    if (missingClear) missingClear.textContent = tr('missing.clearButton', 'Limpar');

    applyPanelState();
    applyCodebergState();
    applyOutputState();
    applyMissingState();
    applyManualState();
    applyCodebergButtonState();
}

    function setOutput(text) {
        const el = document.getElementById(OUTPUT_ID);
        if (el) el.value = text;
    }
    
    function setCapturedOutput(text) {
    const el = document.getElementById(CAPTURED_ID);
    if (el) el.value = text;
}

function hasCodebergPublishConfig() {
    return !!codebergToken && (!!codebergTarget || !!codebergGroupsTarget);
}

function applyCodebergButtonState() {
    const btn = document.getElementById('amq-copy-btn');
    if (!btn) return;

    const publishMode = hasCodebergPublishConfig();
    btn.textContent = publishMode ? tr('codebergButtons.publish', 'Publicar') : tr('codebergButtons.copy', 'Copiar');
    btn.title = publishMode
        ? tr('codebergButtons.publishTitle', 'Publicar JSONs no Codeberg')
        : tr('codebergButtons.copyTitle', 'Copiar o JSON para a área de transferência');
}

function applyCodebergState() {
    const body = document.getElementById('amq-codeberg-body');
    const toggle = document.getElementById('amq-codeberg-toggle-btn');

    if (!body || !toggle) return;

    body.style.display = codebergMinimized ? 'none' : '';
    toggle.textContent = codebergMinimized ? tr('panel.expand', 'Expandir') : tr('panel.minimize', 'Minimizar');

    applyCodebergButtonState();
}

function renderCodebergConfigInUI() {
    applyCodebergButtonState();
}

function syncCodebergConfigFromUI() {
    // configs fixas; não lê nada da UI
    applyCodebergButtonState();
}

function parseCodebergTarget(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;

    const urlMatch = value.match(/^https?:\/\/codeberg\.org\/([^/]+)\/([^/]+)\/(?:src|raw)\/branch\/([^/]+)\/(.+)$/i);
    if (urlMatch) {
        return {
            owner: urlMatch[1],
            repo: urlMatch[2],
            branch: urlMatch[3],
            path: urlMatch[4].replace(/^\/+/, '')
        };
    }

    const parts = value.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (parts.length >= 3) {
        return {
            owner: parts[0],
            repo: parts[1],
            branch: 'main',
            path: parts.slice(2).join('/')
        };
    }

    return null;
}

function toBase64Utf8(text) {
    const bytes = new TextEncoder().encode(String(text || ''));
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
}

function requestCodebergJson(method, url, token, body = null) {
    return new Promise(resolve => {
        const finish = (status, text) => {
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            } catch {
                json = null;
            }

            resolve({
                ok: status >= 200 && status < 300,
                status,
                json,
                text: text || ''
            });
        };

        const headers = {
            Accept: 'application/json'
        };

        if (body !== null) headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = `token ${token}`;

        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method,
                url,
                headers,
                data: body !== null ? JSON.stringify(body) : undefined,
                onload: response => finish(response.status || 0, response.responseText || ''),
                onerror: response => finish(response && response.status ? response.status : 0, '')
            });
            return;
        }

        fetch(url, {
            method,
            headers,
            body: body !== null ? JSON.stringify(body) : undefined
        })
            .then(async response => finish(response.status, await response.text()))
            .catch(() => finish(0, ''));
    });
}

async function publishOutputToCodeberg() {
    const target = parseCodebergTarget(codebergTarget);
    const output = document.getElementById(OUTPUT_ID);

    if (!codebergToken) {
        setStatus('Configure o token do Codeberg para publicar.');
        return;
    }

    if (!target) {
        setStatus('Configure o caminho do arquivo para publicar.');
        return;
    }

    const text = output ? String(output.value || '').trim() : '';
    if (!text) {
        setStatus('JSON vazio. Nada para publicar.');
        return;
    }

    const encodedPath = target.path.split('/').map(encodeURIComponent).join('/');
    const endpoint = `https://codeberg.org/api/v1/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${encodedPath}`;

    const getRes = await requestCodebergJson('GET', `${endpoint}?ref=${encodeURIComponent(target.branch)}`, codebergToken);
    if (!getRes.ok && getRes.status !== 404) {
        setStatus(`Falha ao ler o arquivo no Codeberg (${getRes.status || 'erro'}).`);
        return;
    }

    const payload = {
        branch: target.branch,
        message: `Atualiza ${target.path}`,
        content: toBase64Utf8(text)
    };

    if (getRes.ok && getRes.json && getRes.json.sha) {
        payload.sha = getRes.json.sha;
    }

    const putRes = await requestCodebergJson('PUT', endpoint, codebergToken, payload);
    if (!putRes.ok) {
        setStatus(`Falha ao publicar no Codeberg (${putRes.status || 'erro'}).`);
        return;
    }

    setStatus(`Publicado no Codeberg: ${target.path}`);
}

function decodeBase64Utf8(base64) {
    const clean = String(base64 || '').replace(/\s+/g, '');
    if (!clean) return '';

    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function buildGroupsPublishObject(remoteGroups, incomingGroups) {
    const remoteEntries = Object.entries(remoteGroups || {});
    const incomingEntries = Object.entries(incomingGroups || {}).filter(([group]) => {
        return !Object.prototype.hasOwnProperty.call(remoteGroups || {}, group);
    });

    if (!remoteEntries.length) {
        return Object.fromEntries(incomingEntries);
    }

    const orderedEntries = [
        remoteEntries[0],
        ...incomingEntries,
        ...remoteEntries.slice(1)
    ];

    return Object.fromEntries(orderedEntries);
}

async function publishMissingToCodeberg() {
    const target = parseCodebergTarget(codebergGroupsTarget);
    const output = document.getElementById(MISSING_OUTPUT_ID);

    if (!codebergToken) {
        setStatus('Configure o token do Codeberg para publicar.');
        return;
    }

    if (!target) {
        setStatus('Configure o caminho do groups.json para publicar.');
        return;
    }

    const text = output ? String(output.value || '').trim() : '';
    if (!text) {
        setStatus('JSON de grupos fora da base vazio. Nada para publicar.');
        return;
    }

    let incomingGroups;
    try {
        incomingGroups = normalizeMissingStore(JSON.parse(text));
    } catch {
        setStatus('JSON inválido na seção de grupos fora da base.');
        return;
    }

    if (!Object.keys(incomingGroups).length) {
        setStatus('JSON de grupos fora da base vazio. Nada para publicar.');
        return;
    }

    const encodedPath = target.path.split('/').map(encodeURIComponent).join('/');
    const endpoint = `https://codeberg.org/api/v1/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${encodedPath}`;

    const getRes = await requestCodebergJson('GET', `${endpoint}?ref=${encodeURIComponent(target.branch)}`, codebergToken);
    if (!getRes.ok && getRes.status !== 404) {
        setStatus(`Falha ao ler o groups.json no Codeberg (${getRes.status || 'erro'}).`);
        return;
    }

    let remoteGroups = {};
    if (getRes.ok && getRes.json && typeof getRes.json.content === 'string' && getRes.json.content.trim()) {
        try {
            remoteGroups = JSON.parse(decodeBase64Utf8(getRes.json.content));
        } catch {
            setStatus('Falha ao interpretar o groups.json remoto.');
            return;
        }
    }

    if (!remoteGroups || typeof remoteGroups !== 'object' || Array.isArray(remoteGroups)) {
        remoteGroups = {};
    }

    const mergedGroups = buildGroupsPublishObject(remoteGroups, incomingGroups);
    const mergedText = formatMissingStore(mergedGroups);

    const payload = {
        branch: target.branch,
        message: `Atualiza ${target.path}`,
        content: toBase64Utf8(mergedText)
    };

    if (getRes.ok && getRes.json && getRes.json.sha) {
        payload.sha = getRes.json.sha;
    }

    const putRes = await requestCodebergJson('PUT', endpoint, codebergToken, payload);
    if (!putRes.ok) {
        setStatus(`Falha ao publicar o groups.json (${putRes.status || 'erro'}).`);
        return;
    }

    setStatus(`Publicado no Codeberg: ${target.path}`);
}

function loadMissingStore() {
    try {
        const raw = localStorage.getItem(MISSING_STORAGE_KEY);
        if (!raw) return {};
        return normalizeMissingStore(JSON.parse(raw));
    } catch {
        return {};
    }
}

function normalizeMissingStore(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};

    const normalized = {};

    for (const [group, value] of Object.entries(obj)) {
        const cleanGroup = cleanMemberName(group);
        if (!cleanGroup || !Array.isArray(value)) continue;

        const entries = [];

        for (const item of value) {
            if (!Array.isArray(item)) continue;

            const cleaned = item.length === 1
    ? [cleanTooltipMemberName(item[0])].filter(Boolean)
    : item.map(cleanMemberName).filter(Boolean);
            if (!cleaned.length) continue;

            if (cleaned.length === 1) {
                const member = cleaned[0];
                const exists = entries.some(entry =>
                    Array.isArray(entry) &&
                    entry.length === 1 &&
                    normalizeLoose(entry[0]) === normalizeLoose(member)
                );
                if (!exists) entries.push([member]);
                continue;
            }

            const aliases = [...new Set(cleaned.slice(1))];
            const aliasEntryIndex = entries.findIndex(entry =>
                Array.isArray(entry) &&
                entry.length > 1 &&
                normalizeLoose(entry[0]) === normalizeLoose(cleanGroup)
            );

            if (aliasEntryIndex === -1) {
                entries.push([cleanGroup, ...aliases]);
            } else {
                const aliasEntry = entries[aliasEntryIndex];
                for (const alias of aliases) {
                    const exists = aliasEntry.some(existing =>
                        normalizeLoose(existing) === normalizeLoose(alias)
                    );
                    if (!exists) aliasEntry.push(alias);
                }
            }
        }

        normalized[cleanGroup] = entries;
    }

    return normalized;
}

function saveMissingStore() {
    try {
        localStorage.setItem(MISSING_STORAGE_KEY, JSON.stringify(missingStore));
    } catch {
        // ignore
    }
}

function setMissingOutput(text) {
    const el = document.getElementById(MISSING_OUTPUT_ID);
    if (el) el.value = text;
}

function formatMissingStore(storeObj) {
    const groups = Object.keys(storeObj || {});
    if (!groups.length) return '{}';

    const lines = ['{'];

    groups.forEach((group, groupIndex) => {
        const items = Array.isArray(storeObj[group]) ? storeObj[group] : [];
        lines.push(`  ${JSON.stringify(group)}: [`);

        items.forEach((item, itemIndex) => {
            lines.push(`    ${JSON.stringify(item)}${itemIndex < items.length - 1 ? ',' : ''}`);
        });

        lines.push(`  ]${groupIndex < groups.length - 1 ? ',' : ''}`);
    });

    lines.push('}');
    return lines.join('\n');
}

function refreshMissingOutput() {
    setMissingOutput(formatMissingStore(missingStore));
    saveMissingStore();
}

function getEditableRefs(kind) {
    if (kind === 'main') {
        return {
            textarea: document.getElementById(OUTPUT_ID),
            tools: document.getElementById('amq-output-tools'),
            searchToggle: document.getElementById('amq-output-toggle-btn'),
            minimizeBtn: null,
            search: document.getElementById('amq-output-search')
        };
    }

    return {
        textarea: document.getElementById(MISSING_OUTPUT_ID),
        tools: document.getElementById('amq-missing-tools'),
        searchToggle: document.getElementById('amq-missing-tools-toggle-btn'),
        minimizeBtn: document.getElementById('amq-missing-toggle-btn'),
        search: document.getElementById('amq-missing-search')
    };
}

function applyOutputToolsState() {
    const { tools, searchToggle } = getEditableRefs('main');
    if (tools) tools.style.display = outputToolsOpen ? 'flex' : 'none';
    if (searchToggle) searchToggle.textContent = outputToolsOpen ? '×' : '🔍';
}

function applyOutputState() {
    const body = document.getElementById(OUTPUT_BODY_ID);
    const toggle = document.getElementById('amq-output-minimize-btn');
    if (!body || !toggle) return;

    body.style.display = outputMinimized ? 'none' : '';
    toggle.textContent = outputMinimized ? tr('panel.expand', 'Expandir') : tr('panel.minimize', 'Minimizar');

    applyCodebergButtonState();
}

function applyMissingToolsState() {
    const { tools, search } = getEditableRefs('missing');
    const searchToggle = document.getElementById('amq-missing-tools-toggle-btn');

    if (tools) tools.style.display = missingToolsOpen ? 'flex' : 'none';
    if (searchToggle) searchToggle.textContent = missingToolsOpen ? '×' : '🔍';
}

function searchInTextarea(textarea, query) {
    const needle = cleanMemberName(query);
    if (!textarea || !needle) return false;

    const hay = textarea.value || '';
    const lowerHay = hay.toLowerCase();
    const lowerNeedle = needle.toLowerCase();

    const start = Math.min(textarea.selectionEnd || 0, hay.length);
    let idx = lowerHay.indexOf(lowerNeedle, start);
    if (idx === -1) idx = lowerHay.indexOf(lowerNeedle, 0);
    if (idx === -1) return false;

    textarea.focus();
    textarea.setSelectionRange(idx, idx + needle.length);

    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
    const line = hay.slice(0, idx).split('\n').length - 1;
    textarea.scrollTop = Math.max(0, (line * lineHeight) - (textarea.clientHeight / 2));
    return true;
}

function searchInOutput(kind) {
    const refs = getEditableRefs(kind);
    const query = refs.search ? refs.search.value : '';
    const ok = searchInTextarea(refs.textarea, query);

    if (!ok) {
        setStatus(query ? `"${query}" não encontrado.` : 'Digite um texto para pesquisar.');
    }
}

function saveEditableJson(kind) {
    const refs = getEditableRefs(kind);
    const textarea = refs.textarea;
    if (!textarea) return;

    try {
        const parsed = JSON.parse(textarea.value || '{}');

        if (kind === 'main') {
            store = normalizeStoreLikeObject(parsed);
            saveStore();
            refreshOutput();
            setStatus('Saída atual salva localmente.');
        } else {
            missingStore = normalizeMissingStore(parsed);
            saveMissingStore();
            refreshMissingOutput();
            setStatus('Grupos fora da base salvos localmente.');
        }
    } catch {
        setStatus('JSON inválido nessa saída.');
    }
}

function baseNameExists(name) {
    const target = normalizeLoose(cleanMemberName(name));
    if (!target) return false;

    for (const [group, value] of Object.entries(baseGroups || {})) {
        if (normalizeLoose(group) === target) return true;

        const flat = flattenBaseMembers(group, value);
        if (flat.some(item => normalizeLoose(item) === target)) return true;
    }

    return false;
}

function addMissingGroup(group, members = [], aliases = []) {
    const cleanGroup = cleanMemberName(group);
    if (!cleanGroup) return false;

    if (!Array.isArray(missingStore[cleanGroup])) {
        missingStore[cleanGroup] = [];
    }

    const entries = missingStore[cleanGroup];
    let changed = false;

    const memberList = [...new Set(
        (members || [])
            .map(cleanTooltipMemberName)
            .filter(Boolean)
    )];

    for (const member of memberList) {
        const exists = entries.some(item =>
            Array.isArray(item) &&
            item.length === 1 &&
            normalizeLoose(item[0]) === normalizeLoose(member)
        );

        if (!exists) {
            entries.push([member]);
            changed = true;
        }
    }

    const cleanAliases = [...new Set(
        (aliases || [])
            .map(cleanMemberName)
            .filter(Boolean)
            .filter(alias => normalizeLoose(alias) !== normalizeLoose(cleanGroup))
            .filter(alias => !memberList.some(member => normalizeLoose(member) === normalizeLoose(alias)))
    )];

    if (cleanAliases.length) {
        let aliasEntry = entries.find(item =>
            Array.isArray(item) &&
            item.length > 1 &&
            normalizeLoose(item[0]) === normalizeLoose(cleanGroup)
        );

        if (!aliasEntry) {
            aliasEntry = [cleanGroup];
            entries.push(aliasEntry);
            changed = true;
        }

        for (const alias of cleanAliases) {
            const exists = aliasEntry.some(existing =>
                normalizeLoose(existing) === normalizeLoose(alias)
            );

            if (!exists) {
                aliasEntry.push(alias);
                changed = true;
            }
        }
    }

    if (changed) refreshMissingOutput();
    return changed;
}

function pruneMissingStoreAgainstBase() {
    if (!baseLoaded || !baseGroups || !Object.keys(baseGroups).length) return false;

    let changed = false;
    const cleanedStore = {};

    for (const [group, entries] of Object.entries(missingStore || {})) {
        const cleanGroup = cleanMemberName(group);
        if (!cleanGroup || !Array.isArray(entries)) continue;

        const nextEntries = [];

        for (const item of entries) {
            if (!Array.isArray(item)) continue;

            const cleaned = item.map(cleanMemberName).filter(Boolean);
            if (!cleaned.length) continue;

            if (cleaned.length === 1) {
                const member = cleaned[0];

                const exists = nextEntries.some(entry =>
                    Array.isArray(entry) &&
                    entry.length === 1 &&
                    normalizeLoose(entry[0]) === normalizeLoose(member)
                );
                if (!exists) nextEntries.push([member]);
                continue;
            }

            const aliases = [...new Set(
                cleaned.slice(1)
                    .filter(alias => normalizeLoose(alias) !== normalizeLoose(cleanGroup))
            )];

            if (!aliases.length) {
                changed = true;
                continue;
            }

            const aliasEntryIndex = nextEntries.findIndex(entry =>
                Array.isArray(entry) &&
                entry.length > 1 &&
                normalizeLoose(entry[0]) === normalizeLoose(cleanGroup)
            );

            if (aliasEntryIndex === -1) {
                nextEntries.push([cleanGroup, ...aliases]);
            } else {
                const aliasEntry = nextEntries[aliasEntryIndex];
                for (const alias of aliases) {
                    const exists = aliasEntry.some(existing =>
                        normalizeLoose(existing) === normalizeLoose(alias)
                    );
                    if (!exists) aliasEntry.push(alias);
                }
            }
        }

        cleanedStore[cleanGroup] = nextEntries;
        if (JSON.stringify(nextEntries) !== JSON.stringify(entries)) changed = true;
    }

    if (changed) {
        missingStore = cleanedStore;
        saveMissingStore();
    }

    return changed;
}

function applyMissingState() {
    const body = document.getElementById(MISSING_BODY_ID);
    const toggle = document.getElementById('amq-missing-toggle-btn');
    if (!body || !toggle) return;

    body.style.display = missingMinimized ? 'none' : '';
    toggle.textContent = missingMinimized ? tr('panel.expand', 'Expandir') : tr('panel.minimize', 'Minimizar');
}

function applyManualState() {
    const wrap = document.getElementById('amq-manual-wrap');
    const toggle = document.getElementById('amq-manual-toggle-btn');
    if (!wrap || !toggle) return;

    wrap.style.display = manualVisible ? '' : 'none';
    toggle.textContent = manualVisible ? tr('manual.toggleHide', 'Ocultar campos manuais') : tr('manual.toggleShow', 'Mostrar campos manuais');
}

function refreshCapturedOutput() {
    if (capturedRawData !== null) {
        try {
            setCapturedOutput(JSON.stringify(capturedRawData, null, 2));
            return;
        } catch {
            // cai para o formato normalizado abaixo
        }
    }

    setCapturedOutput(formatStore(capturedStore));
}

function refreshOutput() {
    const merged = mergeStoreObjects(capturedStore, store);
    setOutput(formatStore(merged));
    saveStore();
}

function mergeStoreObjects(baseObj, extraObj) {
    const merged = normalizeStoreLikeObject(baseObj);
    const extras = normalizeStoreLikeObject(extraObj);

    for (const [group, versions] of Object.entries(extras)) {
        if (!Array.isArray(merged[group])) merged[group] = [];

        for (const version of versions) {
            const incoming = normalizeVersionRecord(version);
            if (!incoming) continue;

            const incomingKey = versionKey(
                (incoming.members || []).map(item => Array.isArray(item) ? item[0] : item)
            );

            const existing = merged[group].find(record => {
                const members = Array.isArray(record.members) ? record.members : [];
                const flat = members.map(item => Array.isArray(item) ? item[0] : item);
                return versionKey(flat) === incomingKey;
            });

            if (!existing) {
                merged[group].push(incoming);
                continue;
            }

            if (!Array.isArray(existing.songs)) existing.songs = [];

            for (const song of incoming.songs || []) {
                const normalized = cleanSongName(song);
                if (!normalized) continue;

                const exists = existing.songs.some(existingSong =>
                    normalizeLoose(existingSong) === normalizeLoose(normalized)
                );

                if (!exists) existing.songs.push(normalized);
            }
        }
    }

    return merged;
}
    
    function cloneVersionRecord(record) {
    return {
        members: Array.isArray(record?.members)
            ? record.members.map(item => Array.isArray(item) ? [...item] : [item]).filter(item => item[0])
            : [],
        songs: Array.isArray(record?.songs)
            ? [...new Set(record.songs.map(cleanSongName).filter(Boolean))]
            : []
    };
}

    function normalizeStoreLikeObject(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};

        const normalized = {};

        for (const [group, value] of Object.entries(obj)) {
            if (!Array.isArray(value)) continue;
            normalized[group] = normalizeGroupStore(value);
        }

        return normalized;
    }

    function buildVersionIndexFromStoreLike(storeLike) {
        const index = new Map();

        for (const [group, versions] of Object.entries(storeLike || {})) {
            const set = new Set();

            for (const version of Array.isArray(versions) ? versions : []) {
                const members = Array.isArray(version?.members)
                ? version.members
                : [];

                const flat = members.map(item => Array.isArray(item) ? item[0] : item);
                set.add(versionKey(flat));
            }

            index.set(group, set);
        }

        return index;
    }

    function hasSameCapturedVersion(group, capturedMembers) {
        const set = capturedVersionIndex.get(group);
        if (!set) return false;
        return set.has(versionKey(capturedMembers));
    }
    
    function isCollaborationGroupName(group) {
    if (!group) return true;

    const g = group.trim();

    const collaborationPatterns = [
        /\bfeat\.?\b/i,
        /\bft\.?\b/i,
        /\bfeaturing\b/i,
        /\bcollab(?:oration)?\b/i,
        /\bmeets\b/i,
        /\bpresent\b/i,
        /\bvs\.?\b/i,
        /\band\b/i,
        /\bwith\b/i,
        /\bversus\b/i,
        /\bx\b/i,
        /[&×・]/,
        /,\s*[A-ZÀ-ÖØ-Ý]/,
    ];

    return collaborationPatterns.some(re => re.test(g));
}

    function loadCapturedJson() {
    if (!CAPTURED_JSON_URL || CAPTURED_JSON_URL.includes('COLE_AQUI')) {
        capturedRawData = null;
        capturedStore = {};
        capturedVersionIndex = new Map();
        capturedLoaded = true;
        refreshCapturedOutput();
        refreshOutput();
        return Promise.resolve();
    }

    return loadJson(CAPTURED_JSON_URL).then(data => {
        capturedStore = normalizeStoreLikeObject(data);
        capturedVersionIndex = buildVersionIndexFromStoreLike(capturedStore);
        capturedLoaded = true;
        refreshCapturedOutput();
        refreshOutput();
    }).catch(() => {
        capturedStore = {};
        capturedVersionIndex = new Map();
        capturedLoaded = true;
        refreshCapturedOutput();
        refreshOutput();
    });
}

    function formatStore(storeObj) {
        const groups = Object.keys(storeObj);
        if (groups.length === 0) return '{}';

        const lines = ['{'];

        groups.forEach((group, groupIndex) => {
            const versions = Array.isArray(storeObj[group]) ? storeObj[group] : [];
            lines.push(`  ${JSON.stringify(group)}: [`);

            versions.forEach((version, versionIndex) => {
                lines.push('    {');
                lines.push('      "members": [');

                const members = Array.isArray(version.members) ? version.members : [];
                members.forEach((member, memberIndex) => {
                    lines.push(`        ${JSON.stringify(member)}${memberIndex < members.length - 1 ? ',' : ''}`);
                });

                lines.push('      ],');
                lines.push('      "songs": [');

                const songs = Array.isArray(version.songs) ? version.songs : [];
                songs.forEach((song, songIndex) => {
                    lines.push(`        ${JSON.stringify(song)}${songIndex < songs.length - 1 ? ',' : ''}`);
                });

                lines.push('      ]');
                lines.push(`    }${versionIndex < versions.length - 1 ? ',' : ''}`);
                });

            lines.push(`  ]${groupIndex < groups.length - 1 ? ',' : ''}`);
        });

        lines.push('}');
        return lines.join('\n');
    }

    function isSectionStart(line) {
        return /^(Group|Other Names|Members|Member of|Artist)\b/i.test(line);
    }

    function extractPrimaryName(lines) {
        const idx = lines.findIndex(line => /^(Group|Artist)\b/i.test(line));
        if (idx === -1) return { type: '', name: '' };

        const type = /^Artist\b/i.test(lines[idx]) ? 'Artist' : 'Group';

        const sameLine = lines[idx].replace(new RegExp(`^${type}\\b\\s*`, 'i'), '').trim();
        if (sameLine) return { type, name: sameLine };

        for (let i = idx + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (isSectionStart(line)) break;
            return { type, name: line.replace(/^[A-Z]\s+/, '').trim() };
        }

        return { type, name: '' };
    }

    function cleanOtherName(name) {
        const s = cleanMemberName(name);
        if (!s) return '';
        if (/^[AG]$/.test(s)) return '';
        return s;
    }

    function extractMembers(lines, groupName = '') {
    const startIndex = lines.findIndex(line => /^(Members|Member of)\b/i.test(line));
    if (startIndex === -1) return [];

    const members = [];
    const groupNameNorm = cleanMemberName(groupName).toLowerCase();

    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (isSectionStart(line)) break;

        const cleaned = cleanTooltipMemberName(line);

if (!cleaned) continue;
        if (/^[AG]$/.test(cleaned)) continue;
        if (cleanMemberName(cleaned).toLowerCase() === groupNameNorm) continue;
        if (!members.includes(cleaned)) members.push(cleaned);
    }

    return members;
}

    function extractOtherNames(lines, entityName) {
    const startIndex = lines.findIndex(line => /^Other Names\b/i.test(line));
    if (startIndex === -1) return [];

    const aliases = [];
    const entityNameNorm = cleanMemberName(entityName).toLowerCase();

    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (isSectionStart(line)) break;

        const cleaned = cleanOtherName(line);
        if (!cleaned) continue;
        if (cleaned.toLowerCase() === entityNameNorm) continue;
        if (!aliases.includes(cleaned)) aliases.push(cleaned);
    }

    return aliases;
}

    function parseTooltipCandidate(rawText) {
    const text = normalizeText(rawText);
    if (!text) return null;

    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return null;

    const { type, name } = extractPrimaryName(lines);
    if (!type || !name) return null;

    const aliases = extractOtherNames(lines, name);

   if (type === 'Group') {
    const isCollab = isCollaborationGroupName(name);

    const members = extractMembers(lines, name);
    if (!members.length) return null;

    return {
        type,
        name,
        members,
        aliases,
        isCollab,
        signature: `${type}||${name}||${members.map(normalizeLoose).join('|')}||${aliases.map(normalizeLoose).join('|')}||${isCollab ? '1' : '0'}`
    };
}

    if (type === 'Artist') {
        if (!aliases.length) return null;

        return {
            type,
            name,
            members: [],
            aliases,
            signature: `${type}||${name}||${aliases.map(normalizeLoose).join('|')}`
        };
    }

    return null;
}

    function isAliasMemberEntry(group, item) {
    if (!group || !Array.isArray(item)) return false;
    const groupNorm = normalizeLoose(group);
    return item.some(name => normalizeLoose(name) === groupNorm);
}

function flattenBaseMembers(group, groupValue) {
    const out = [];

    if (!Array.isArray(groupValue)) return out;

    for (const item of groupValue) {
        if (Array.isArray(item)) {
            if (isAliasMemberEntry(group, item)) continue;

            for (const name of item) {
                const cleaned = cleanTooltipMemberName(name);
                if (cleaned) out.push(cleaned);
            }
        } else {
            const cleaned = cleanTooltipMemberName(item);
            if (cleaned) out.push(cleaned);
        }
    }

    return out;
}

    function versionKey(list) {
        return [...new Set(
            (list || [])
            .map(cleanTooltipMemberName)
            .filter(Boolean)
            .map(normalizeLoose)
        )].sort().join('|');
    }

        function rebuildBaseVersionIndex() {
    baseVersionIndex = new Map();

    for (const [group, value] of Object.entries(baseGroups || {})) {
        const flatMembers = flattenBaseMembers(group, value);
        const key = versionKey(flatMembers);

        baseVersionIndex.set(group, key);
    }
}

function findBaseGroupKey(group) {
    if (!group) return null;

    if (Object.prototype.hasOwnProperty.call(baseGroups || {}, group)) {
        return group;
    }

    const target = normalizeLoose(cleanMemberName(group) || group);
    if (!target) return null;

    for (const key of Object.keys(baseGroups || {})) {
        if (normalizeLoose(key) === target) {
            return key;
        }
    }

    return null;
}

function getBaseVersionKey(group) {
    const exactKey = baseVersionIndex.get(group);
    if (exactKey != null) return exactKey;

    const resolvedGroup = findBaseGroupKey(group);
    if (!resolvedGroup) return null;

    const resolvedKey = baseVersionIndex.get(resolvedGroup);
    return resolvedKey != null ? resolvedKey : null;
}

    function baseGroupExists(group) {
    return !!findBaseGroupKey(group);
}

    function hasSameBaseVersion(group, capturedMembers) {
    const targetKey = versionKey(capturedMembers);

    const baseKey = getBaseVersionKey(group);
    if (baseKey != null) {
        return baseKey === targetKey;
    }

    for (const key of baseVersionIndex.values()) {
        if (key === targetKey) {
            return true;
        }
    }

    return false;
}

    function hasAlreadyCapturedVersion(group, capturedMembers) {
        return hasSameCapturedVersion(group, capturedMembers);
    }

    function getGroupStore(group) {
        if (!store[group]) store[group] = [];
        return store[group];
    }

    function findVersionRecord(group, capturedMembers) {
        const records = getGroupStore(group);
        const targetKey = versionKey(capturedMembers);

        return records.find(record => {
            const members = Array.isArray(record.members) ? record.members : [];
            const flat = members.map(item => Array.isArray(item) ? item[0] : item);
            return versionKey(flat) === targetKey;
        }) || null;
    }

    function addSongToRecord(record, songName) {
        const song = cleanSongName(songName);
        if (!song) return false;

        if (!Array.isArray(record.songs)) record.songs = [];

        const exists = record.songs.some(existing => normalizeLoose(existing) === normalizeLoose(song));
        if (exists) return false;

        record.songs.push(song);
        return true;
    }

    function upsertVersion(group, capturedMembers, songName = '') {
        if (!baseGroupExists(group)) {
            return { action: 'missing-base' };
        }

        if (hasSameBaseVersion(group, capturedMembers)) {
            return { action: 'same-base' };
        }

        const records = getGroupStore(group);
        let record = findVersionRecord(group, capturedMembers);

        let created = false;
        if (!record) {
            record = {
                members: capturedMembers.map(name => [name]),
                songs: []
            };
            records.push(record);
            created = true;
        }

        let songAdded = false;
        if (songName) {
            songAdded = addSongToRecord(record, songName);
        }

        if (created || songAdded) {
            refreshOutput();
        }

        if (created && songAdded) return { action: 'created-and-song-added' };
        if (created) return { action: 'created' };
        if (songAdded) return { action: 'song-added' };
        return { action: 'already-exists' };
    }

    function getVideoList() {
        if (typeof quizVideoController === 'undefined' || !quizVideoController) return [];

        const player = typeof quizVideoController.getCurrentPlayer === 'function'
        ? quizVideoController.getCurrentPlayer()
        : null;

        const videoMap = player && player.videoMap ? player.videoMap : null;
        if (!videoMap) return [];

        let host = videoMap.catbox;
        if (!host) host = videoMap.openingsmoe;
        if (!host) return [];

        const list = [];
        if (host['720']) list.push(host['720']);
        if (host['480']) list.push(host['480']);
        if (host['0']) list.push(host['0']);
        return list;
    }

    function getVideoData(videoList) {
        let song;
        for (const id of videoList) {
            if ((song = songDb[id])) break;
        }

        if (typeof song === 'string') {
            song = songDb[song];
        }

        return song;
    }

    function getCurrentSongName() {
    const data = getVideoData(getVideoList());
    if (!data) return '';
    if (Array.isArray(data)) return cleanSongName(data[1] || '');
    if (data && typeof data === 'object') return cleanSongName(data.songName || data.title || '');
    return '';
}

function getCurrentSongArtistAliases() {
    const data = getVideoData(getVideoList());
    if (!data || !Array.isArray(data)) return [];

    const primaryBlocks = Array.isArray(data[3]) && data[3].length
        ? data[3]
        : [[String(data[2] ?? '').trim()]];

    const aliases = [];
    const seen = new Set();

    for (const block of primaryBlocks) {
        const groupAliases = Array.isArray(block) ? block : [block];

        for (const alias of groupAliases) {
            const cleaned = cleanMemberName(alias);
            const normalized = normalizeLoose(cleaned);

            if (!cleaned || !normalized || seen.has(normalized)) {
                continue;
            }

            seen.add(normalized);
            aliases.push(cleaned);
        }
    }

    return aliases;
}

function describeCurrentSongArtist() {
    const aliases = getCurrentSongArtistAliases();
    if (!aliases.length) return 'desconhecido';
    return aliases.join(' / ');
}

function currentSongMatchesTooltipArtist(parsed) {
    const currentAliases = getCurrentSongArtistAliases();
    if (!currentAliases.length) return false;

    const tooltipAliases = [
        parsed?.name,
        ...(Array.isArray(parsed?.aliases) ? parsed.aliases : [])
    ]
        .map(alias => normalizeLoose(cleanMemberName(alias)))
        .filter(Boolean);

    if (!tooltipAliases.length) return false;

    const tooltipSet = new Set(tooltipAliases);
    return currentAliases.some(alias => tooltipSet.has(normalizeLoose(alias)));
}

    function populateManualFields(group, members, song = '') {
    const groupInput = document.getElementById('amq-manual-group');
    const membersInput = document.getElementById('amq-manual-members');
    const songInput = document.getElementById('amq-manual-song');

    manualVisible = true;
    localStorage.setItem(MANUAL_VISIBLE_KEY, '1');
    applyManualState();

    if (groupInput) groupInput.value = group || '';
    if (membersInput) membersInput.value = (members || []).join('\n');
    if (songInput) songInput.value = song || '';

    panelMinimized = false;
    localStorage.setItem(PANEL_MINIMIZED_KEY, '0');
    applyPanelState();

    if (songInput && !song) {
        songInput.focus();
    }
}

function fillManualFieldsSilently(group, members) {
    const groupInput = document.getElementById('amq-manual-group');
    const membersInput = document.getElementById('amq-manual-members');

    if (groupInput) groupInput.value = group || '';
    if (membersInput) membersInput.value = (members || []).join('\n');
}

    function parseManualMembers(text) {
    return (text || '')
        .split(/[\n;•]+/g)
        .map(part => cleanTooltipMemberName(part))
        .filter(Boolean)
        .filter(part => !/^[AG]$/.test(part));
}

    function handleManualSave() {
    const groupInput = document.getElementById('amq-manual-group');
    const membersInput = document.getElementById('amq-manual-members');
    const songInput = document.getElementById('amq-manual-song');

    const group = cleanMemberName(groupInput ? groupInput.value : '');
    const members = parseManualMembers(membersInput ? membersInput.value : '');
    const song = cleanSongName(songInput ? songInput.value : '');

    if (!group) {
        setStatus('Digite o grupo.');
        return;
    }

    if (!members.length) {
        setStatus('Digite ao menos um membro.');
        return;
    }

    if (!baseGroupExists(group)) {
        addMissingGroup(group, members, []);
        setStatus(`Grupo fora da base salvo em JSON separado: ${group}`);

        if (groupInput) groupInput.value = '';
        if (membersInput) membersInput.value = '';
        if (songInput) songInput.value = '';
        return;
    }

    if (hasSameBaseVersion(group, members)) {
        setStatus(`Ignorado: ${group} já tem essa versão na base.`);
        return;
    }

    if (!song) {
    addMissingGroup(group, members, []);
    setStatus(`Grupo fora da base salvo em JSON separado: ${group}`);

    if (groupInput) groupInput.value = '';
    if (membersInput) membersInput.value = '';
    if (songInput) songInput.value = '';
    return;
}

const result = upsertVersion(group, members, song);

if (result.action === 'missing-base') {
    // para manual, cria mesmo fora da base
    if (!store[group]) store[group] = [];

    const record = {
        members: members.map(name => [name]),
        songs: [song]
    };

    store[group].push(record);
    refreshOutput();
    setStatus(`Versão salva manualmente: ${group}`);

    if (groupInput) groupInput.value = '';
    if (membersInput) membersInput.value = '';
    if (songInput) songInput.value = '';
    return;
}

    if (result.action === 'same-base') {
        setStatus(`Ignorado: ${group} já tem essa versão na base.`);
        return;
    }

    refreshOutput();
    setStatus(`Versão salva manualmente: ${group}`);

    if (groupInput) groupInput.value = '';
    if (membersInput) membersInput.value = '';
    if (songInput) songInput.value = '';
}  

    function looksLikeTooltip(el) {
        if (!el || el.nodeType !== 1 || !isVisible(el)) return false;

        const text = normalizeText(el.innerText || el.textContent || '');
        if (!text) return false;

        return (
            /^Group\b/i.test(text) ||
            /\nGroup\b/i.test(text) ||
            /^Members\b/i.test(text) ||
            /\nMembers\b/i.test(text) ||
            /^Member of\b/i.test(text) ||
            /\nMember of\b/i.test(text) ||
            /Other Names/i.test(text)
        );
    }

    function scoreCandidate(el) {
        const text = normalizeText(el.innerText || el.textContent || '');
        let score = 0;

        if (/^Group\b/i.test(text) || /\nGroup\b/i.test(text)) score += 3;
        if (/^Members\b/i.test(text) || /\nMembers\b/i.test(text)) score += 3;
        if (/^Member of\b/i.test(text) || /\nMember of\b/i.test(text)) score += 3;
        if (/Other Names/i.test(text)) score += 1;
        if (text.length < 7000) score += 1;

        const style = getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') score += 1;

        const z = Number.parseInt(style.zIndex, 10);
        if (!Number.isNaN(z) && z > 10) score += 1;

        const rect = el.getBoundingClientRect();
        if (rect.width > 120 && rect.height > 50) score += 1;

        const area = rect.width * rect.height;
        if (area > 0 && area < 300000) score += 1;

        return score;
    }

    function getCandidatesFromRoot(root) {
        const candidates = [];
        const add = el => {
            if (el && el.nodeType === 1 && !candidates.includes(el) && looksLikeTooltip(el)) {
                candidates.push(el);
            }
        };

        if (!root) return candidates;

        if (root.nodeType === Node.ELEMENT_NODE) {
            add(root);

            root.querySelectorAll(TOOLTIP_SELECTOR).forEach(add);

            root.querySelectorAll('*').forEach(el => {
                const text = normalizeText(el.innerText || el.textContent || '');
                if (
                    text.includes('Group') ||
                    text.includes('Members') ||
                    text.includes('Member of') ||
                    text.includes('Other Names')
                ) {
                    add(el);
                }
            });
        }return candidates;
    }

    function getLeafCandidates(candidates) {
        return candidates.filter(candidate =>
                                 !candidates.some(other => other !== candidate && other.contains(candidate))
                                );
    }

    function findBestCandidateFromRoot(root) {
        const candidates = getCandidatesFromRoot(root);
        if (!candidates.length) return null;

        const leafCandidates = getLeafCandidates(candidates);
        const picked = (leafCandidates.length ? leafCandidates : candidates)
        .map(el => ({ el, score: scoreCandidate(el) }))
        .filter(item => item.score >= 4)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const rectA = a.el.getBoundingClientRect();
            const rectB = b.el.getBoundingClientRect();
            return (rectA.width * rectA.height) - (rectB.width * rectB.height);
        });

        return picked.length ? picked[0].el : null;
    }

    function rememberCaptureKey(key, ttlMs = 3000) {
        const now = Date.now();
        const last = recentCaptureTimes.get(key) || 0;
        if (now - last < ttlMs) return false;
        recentCaptureTimes.set(key, now);

        if (recentCaptureTimes.size > 200) {
            for (const [k, ts] of recentCaptureTimes.entries()) {
                if (now - ts > ttlMs * 4) recentCaptureTimes.delete(k);
            }
        }

        return true;
    }

    function processCapturedVersion(parsed, songName = '') {
    if (parsed.type === 'Artist') {
    if (!parsed.aliases || !parsed.aliases.length) return;

    if (baseGroupExists(parsed.name)) {
        setStatus(`Tooltip identificado: ${parsed.name}. Artista já existe na base.`);
        return;
    }

    addMissingGroup(parsed.name, [], parsed.aliases);
    setStatus(`Tooltip detectado: ${parsed.name}. Artista salvo fora da base.`);
    return;
}

        const isCollab = !!parsed.isCollab || isCollaborationGroupName(parsed.name);
    const sameBaseVersion = hasSameBaseVersion(parsed.name, parsed.members);

    if (sameBaseVersion) {
        setStatus(`Tooltip identificado: ${parsed.name}. Versão já existe na base.`);
        return;
    }

    if (!baseGroupExists(parsed.name)) {
        if (isCollab) {
            fillManualFieldsSilently(parsed.name, parsed.members);
            setStatus(`Tooltip detectado: ${parsed.name}. Collab fora da base; campos preenchidos automaticamente.`);
            return;
        }

        addMissingGroup(parsed.name, parsed.members, parsed.aliases);
        setStatus(`Tooltip detectado: ${parsed.name}. Grupo fora da base salvo em JSON separado.`);
        return;
    }

    if (isCollab) {
        setStatus(`Tooltip detectado: ${parsed.name}. Collab ignorada pela regra atual.`);
        return;
    }

    if (!songName) {
        populateManualFields(parsed.name, parsed.members, '');
        setStatus(`Tooltip detectado: ${parsed.name}. SongDB não encontrou a música atual; preencha o nome da música manualmente.`);
        return;
    }

    if (!currentSongMatchesTooltipArtist(parsed)) {
        populateManualFields(parsed.name, parsed.members, '');
        setStatus(`Comparação falhou: tooltip (${parsed.name}) ≠ música atual (${describeCurrentSongArtist()}). Campos preenchidos automaticamente.`);
        return;
    }

    const result = upsertVersion(parsed.name, parsed.members, songName);

    if (result.action === 'created' || result.action === 'created-and-song-added') {
        setStatus(`Salvo com sucesso: ${parsed.name} / ${songName}.`);
    } else if (result.action === 'song-added') {
        setStatus(`Música adicionada na versão existente: ${parsed.name} / ${songName}.`);
    } else if (result.action === 'already-exists') {
        setStatus(`Ignorado: ${parsed.name} / ${songName} já existe.`);
    }
}

    function flushPending() {
    const roots = [...pendingRoots];
    pendingRoots.clear();

    for (const root of roots) {
        if (!root || !root.isConnected) continue;

        const candidate = findBestCandidateFromRoot(root);
        if (!candidate || !candidate.isConnected || !isVisible(candidate)) continue;

        const rawText = candidate.innerText || candidate.textContent || collectTextWithBreaks(candidate);
        const parsed = parseTooltipCandidate(rawText);
        if (!parsed) continue;

                const currentSongName = getCurrentSongName();
        const tooltipKey = versionKey(parsed.members);
        const captureKey = `${parsed.name}||${tooltipKey}||${normalizeLoose(currentSongName)}`;

        if (!rememberCaptureKey(captureKey)) continue;

        if (hasSameBaseVersion(parsed.name, parsed.members)) {
            setStatus(`Tooltip identificado: ${parsed.name}. Versão já existe na base.`);
            continue;
        }

        processCapturedVersion(parsed, currentSongName);
    }
}

    function queueRoot(root) {
        if (!root || !root.nodeType) return;
        pendingRoots.add(root);
        scheduleFlush();
    }

    function scheduleFlush() {
        if (scanScheduled) return;
        scanScheduled = true;

        requestAnimationFrame(() => {
            scanScheduled = false;

            if (flushTimer) clearTimeout(flushTimer);
            flushTimer = setTimeout(flushPending, 120);
        });
    }

    function initObserver() {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node && node.nodeType === Node.ELEMENT_NODE) {
                            queueRoot(node);
                        }
                    });
                } else if (mutation.type === 'characterData') {
                    const parent = mutation.target && mutation.target.parentElement;
                    if (parent) queueRoot(parent);
                }
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    }

    function parseBaseJson(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const cleaned = {};

    for (const [group, value] of Object.entries(obj)) {
        if (!group) continue;

        if (Array.isArray(value)) {
            cleaned[group] = value;
            continue;
        }

        if (value && typeof value === 'object') {
            if (Array.isArray(value.members)) {
                cleaned[group] = value.members;
                continue;
            }

            if (Array.isArray(value.versions)) {
                cleaned[group] = value.versions
                    .map(version => Array.isArray(version?.members) ? version.members : null)
                    .filter(Boolean);
            }
        }
    }

    return cleaned;
}

    function loadJson(url, timeoutMs = 12000) {
    return new Promise(resolve => {
        let settled = false;

        const finish = data => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(data);
        };

        const timer = setTimeout(() => finish(null), timeoutMs);

        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                timeout: timeoutMs,
                onload: response => {
                    try {
                        finish(JSON.parse(response.responseText));
                    } catch {
                        finish(null);
                    }
                },
                onerror: () => finish(null),
                ontimeout: () => finish(null)
            });
            return;
        }

        const controller = new AbortController();
        const fetchTimer = setTimeout(() => controller.abort(), timeoutMs);

        fetch(url, { mode: 'cors', signal: controller.signal })
            .then(res => res.text())
            .then(text => {
                try {
                    finish(JSON.parse(text));
                } catch {
                    finish(null);
                }
            })
            .catch(() => finish(null))
            .finally(() => clearTimeout(fetchTimer));
    });
}

    function loadBaseGroups() {
        return loadJson(BASE_GROUPS_URL).then(data => parseBaseJson(data));
    }

    function loadSongDatabase() {
        return loadJson(SONG_DB_URL).then(data => {
            if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
            return data;
        });
    }

    async function bootstrap() {
    ensurePanel();

    Promise.all([loadBaseGroups(), loadSongDatabase(), loadCapturedJson(), loadEnglishPack()]).then(([groups, songs]) => {
    baseGroups = groups || {};
songDb = songs || {};
baseLoaded = true;
songsLoaded = true;

rebuildBaseVersionIndex();

try {
    applyLocalizedTexts();
    applyOutputToolsState();
    applyMissingToolsState();
    refreshOutput();
    refreshMissingOutput();
    pruneMissingStoreAgainstBase();
    refreshMissingOutput();

    setStatus('Bases carregadas. Aguardando tooltip...');
    initObserver();

        document.addEventListener('mouseover', scheduleFlush, true);
        document.addEventListener('focusin', scheduleFlush, true);
        window.addEventListener('scroll', scheduleFlush, true);
        window.addEventListener('resize', scheduleFlush);
    } catch (err) {
        console.error('[AMQ Group Tooltip] bootstrap pós-load falhou:', err);
        setStatus('Bases carregadas. Aguardando tooltip...');
        initObserver();

        document.addEventListener('mouseover', scheduleFlush, true);
        document.addEventListener('focusin', scheduleFlush, true);
        window.addEventListener('scroll', scheduleFlush, true);
        window.addEventListener('resize', scheduleFlush);
    }

        setTimeout(() => {
            document.querySelectorAll(TOOLTIP_SELECTOR).forEach(el => {
                if (isVisible(el)) pendingRoots.add(el);
            });
            if (pendingRoots.size) scheduleFlush();
        }, 250);
    }).catch(() => {
        baseLoaded = true;
        songsLoaded = true;
        setStatus('Falha ao carregar uma das bases, mas o painel foi iniciado.');
        initObserver();

        document.addEventListener('mouseover', scheduleFlush, true);
        document.addEventListener('focusin', scheduleFlush, true);
        window.addEventListener('scroll', scheduleFlush, true);
        window.addEventListener('resize', scheduleFlush);
    });
}

    function installStyles() {
    GM_addStyle(`
        #${PANEL_ID} {
            position: fixed;
            z-index: 999999;
            width: 450px;
            max-width: calc(100vw - 32px);
            background: rgba(20, 20, 24, 0.96);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.35);
            padding: 12px;
            font-family: Arial, sans-serif;
            backdrop-filter: blur(6px);
        }
        
                #${PANEL_ID} .amq-codeberg-config {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            background: rgba(0,0,0,0.18);
        }

        #${PANEL_ID} .amq-manual-toggle-row {
            display: flex;
            justify-content: flex-end;
        }

        #${PANEL_ID}.is-minimized {
            width: 180px;
            min-width: 180px;
            max-width: 180px;
            padding: 8px;
        }

        #${PANEL_ID}.is-minimized .amq-header {
            margin-bottom: 0;
        }

        #${PANEL_ID} .amq-manual {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            background: rgba(0,0,0,0.18);
        }

        #${PANEL_ID} .amq-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 10px;
            cursor: grab;
            user-select: none;
        }
        
        #${PANEL_ID} .amq-lang-select {
    width: 56px;
    min-width: 56px;
    height: 30px;
    padding: 0 6px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    background: rgba(0,0,0,0.25);
    color: #fff;
    outline: none;
    font-size: 11px;
    cursor: pointer;
}

        #${PANEL_ID} .amq-header:active {
            cursor: grabbing;
        }

        #${PANEL_ID} .amq-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        #${PANEL_ID} button {
            border: 0;
            border-radius: 8px;
            padding: 6px 10px;
            cursor: pointer;
            background: #2d6cdf;
            color: white;
            font-size: 12px;
        }

        #${PANEL_ID} button:hover {
            filter: brightness(1.08);
        }

        #${PANEL_ID} .amq-body {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        #${PANEL_ID} .amq-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        #${PANEL_ID} .amq-section-label {
            font-size: 12px;
            opacity: 0.85;
        }

        #${PANEL_ID} .amq-lens-btn {
            width: 30px;
            min-width: 30px;
            height: 30px;
            padding: 0;
            border-radius: 8px;
            line-height: 1;
        }

        #${PANEL_ID} .amq-tools {
            display: none;
            gap: 6px;
            align-items: center;
        }

        #${PANEL_ID} .amq-tools input {
            flex: 1;
            min-width: 0;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            padding: 8px;
            background: rgba(0,0,0,0.25);
            color: #fff;
            outline: none;
            font-size: 13px;
            font-family: Consolas, Monaco, monospace;
        }

        #${PANEL_ID} .amq-tools button {
            white-space: nowrap;
        }

        #${PANEL_ID} .amq-manual-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        #${PANEL_ID} .amq-manual-row label {
            font-size: 12px;
            opacity: 0.85;
        }

                #${PANEL_ID} .amq-manual input,
        #${PANEL_ID} .amq-manual textarea,
        #${PANEL_ID} .amq-codeberg-config input,
        #${OUTPUT_ID},
        #${MISSING_OUTPUT_ID} {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            padding: 8px;
            background: rgba(0,0,0,0.25);
            color: #fff;
            outline: none;
            font-size: 13px;
            font-family: Consolas, Monaco, monospace;
        }

        #${OUTPUT_ID},
        #${MISSING_OUTPUT_ID} {
            min-height: 260px;
            resize: vertical;
        }

        #${MISSING_OUTPUT_ID} {
            min-height: 180px;
        }

        #${PANEL_ID} .amq-status {
            font-size: 12px;
            opacity: 0.85;
        }

        #${PANEL_ID}.is-minimized #${BODY_ID} {
            display: none;
        }
    `);
}
    function init() {
        installStyles();
        bootstrap();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
