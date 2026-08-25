import {
  PHASES,
  RULE_DATA,
  bettingAction,
  cardLabel,
  chooseKeep,
  choosePlunderTransfer,
  compactCardLabel,
  copperToCoins,
  createGame,
  dealNextGame,
  declinePlunder,
  formatCopper,
  getCurrentActor,
  plunder,
  selectCommon,
} from "./engine.mjs";

const MODULE_ID = "poppys-prize";
const STATE_SETTING = "tableState";
const PUBLIC_STATE_SETTING = "publicBoard";
const PLAYER_VIEW_FLAG = "playerView";
const PLAYER_REQUEST_FLAG = "playerRequest";
const PLAYER_STATUS_FLAG = "playerStatus";
let tableApp = null;
let playerApp = null;
let actionQueue = Promise.resolve();

function i18n(key, data = {}) {
  return game.i18n.format(`${MODULE_ID}.${key}`, data);
}

function notify(level, message) {
  ui.notifications[level]?.(message);
}

function escapeHTML(value) {
  const string = String(value ?? "");
  return string.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}

function currentState() {
  return game.settings.get(MODULE_ID, STATE_SETTING);
}

function isGM() {
  return game.user?.isGM === true;
}

function getActor(actorId) {
  return actorId ? game.actors.get(actorId) ?? null : null;
}

function sortActorsByName(actors) {
  return [...actors].sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
}

function getParticipantActorGroups() {
  const eligible = game.actors.filter((actor) => ["character", "npc"].includes(actor.type));
  const partyMemberIds = new Set((game.actors.party?.members ?? []).map((member) => member.id));
  return {
    partyMembers: sortActorsByName(eligible.filter((actor) => partyMemberIds.has(actor.id))),
    otherActors: sortActorsByName(eligible.filter((actor) => !partyMemberIds.has(actor.id))),
  };
}

function getParticipantActors() {
  const { partyMembers, otherActors } = getParticipantActorGroups();
  return [...partyMembers, ...otherActors];
}

function getPlayer(state, id) {
  return state?.players?.find((player) => player.id === id) ?? null;
}

function playerName(state, id) {
  return getPlayer(state, id)?.name ?? "Unknown player";
}

function hasAutoCurrency(state = currentState()) {
  return state?.autoCurrency === true;
}

function isPrimaryGM() {
  return isGM() && game.users.activeGM?.id === game.user.id;
}

function getPlayerForActor(state, actorId) {
  return state?.players?.find((player) => player.actorId === actorId) ?? null;
}

function publicCard(entry) {
  return entry?.revealed ? entry.card : null;
}

function buildPublicBoard(state) {
  if (!state) return null;
  return {
    version: 1,
    gameNumber: state.gameNumber,
    phase: state.phase,
    round: state.round,
    potCp: state.potCp,
    anteCp: state.anteCp,
    dealerSeat: state.dealerSeat,
    currentActorId: getCurrentActor(state),
    autoCurrency: hasAutoCurrency(state),
    common: state.common.map((entry) => ({ seat: entry.seat, playerId: entry.playerId, name: entry.name, dummy: entry.dummy, revealed: entry.revealed, card: publicCard(entry) })),
    players: state.players.map((player) => ({ id: player.id, actorId: player.actorId, name: player.name, seat: player.seat, folded: player.folded, contributionCp: player.contributionCp, commonSelected: state.common.some((entry) => entry.playerId === player.id) })),
    betting: state.betting ? { currentBet: state.betting.currentBet, minRaise: state.betting.minRaise, turnSeat: state.betting.turnSeat, stage: state.betting.stage, roundBets: state.betting.roundBets } : null,
    plunder: state.plunder ? { queue: state.plunder.queue.map((entry) => entry.playerId), index: state.plunder.index } : null,
    pendingPlunder: state.pendingPlunder ? { fromId: state.pendingPlunder.fromId, targetId: state.pendingPlunder.targetId, suit: state.pendingPlunder.suit, rank: state.pendingPlunder.rank } : null,
    winners: state.winners ?? [],
    payouts: (state.payouts ?? []).map((payout) => ({ playerId: payout.playerId, copper: payout.copper, paid: payout.paid === true })),
    lastShowdown: state.lastShowdown ? {
      winners: [...state.lastShowdown.winners],
      scores: Object.fromEntries(Object.entries(state.lastShowdown.scores ?? {}).map(([playerId, score]) => [playerId, { name: score.name }])),
    } : null,
  };
}

function buildPlayerView(state, player) {
  const currentId = getCurrentActor(state);
  const canSelectCommon = state.phase === PHASES.SELECT_COMMON && !state.common.some((entry) => entry.playerId === player.id);
  const canBet = state.phase === PHASES.BETTING && currentId === player.id;
  const canPlunder = state.phase === PHASES.PLUNDER && currentId === player.id;
  const canTransfer = state.phase === PHASES.TRANSFER && state.pendingPlunder?.targetId === player.id;
  const canKeep = state.phase === PHASES.KEEP && state.keepers && state.keepers[player.id] !== undefined;
  const protectedPlayerIds = state.plunder?.queue?.map((entry) => entry.playerId) ?? [];
  return {
    version: 1,
    actorId: player.actorId,
    board: buildPublicBoard(state),
    player: {
      id: player.id,
      name: player.name,
      seat: player.seat,
      folded: player.folded,
      contributionCp: player.contributionCp,
      hand: player.hand,
      forcedCarry: player.forcedCarry ?? [],
      selectedKeep: state.keepers?.[player.id] ?? false,
      isWinner: (state.winners ?? []).includes(player.id),
      showdown: state.lastShowdown?.scores?.[player.id] ?? null,
    },
    choices: {
      canSelectCommon,
      canBet,
      canPlunder,
      canTransfer,
      canKeep,
      keepCommon: canKeep && (state.winners ?? []).includes(player.id),
      transferMatches: canTransfer ? state.pendingPlunder.matches : [],
      plunderTargets: canPlunder ? state.players.filter((entry) => entry.id !== player.id && !protectedPlayerIds.includes(entry.id)).map((entry) => ({ id: entry.id, name: entry.name })) : [],
    },
  };
}

async function syncPlayerViews(state) {
  await game.settings.set(MODULE_ID, PUBLIC_STATE_SETTING, buildPublicBoard(state));
  for (const player of state.players) {
    const actor = getActor(player.actorId);
    if (actor?.setFlag) await actor.setFlag(MODULE_ID, PLAYER_VIEW_FLAG, buildPlayerView(state, player));
  }
}

async function clearPlayerViews(state) {
  await game.settings.set(MODULE_ID, PUBLIC_STATE_SETTING, null);
  for (const player of state?.players ?? []) {
    const actor = getActor(player.actorId);
    if (!actor?.unsetFlag) continue;
    await actor.unsetFlag(MODULE_ID, PLAYER_VIEW_FLAG);
    await actor.unsetFlag(MODULE_ID, PLAYER_REQUEST_FLAG);
    await actor.unsetFlag(MODULE_ID, PLAYER_STATUS_FLAG);
  }
}

function getPlayerActorForCurrentUser() {
  const openedActor = playerApp?.actorId ? getActor(playerApp.actorId) : null;
  if (openedActor?.isOwner && openedActor.getFlag(MODULE_ID, PLAYER_VIEW_FLAG)) return openedActor;
  const defaultActor = game.user?.character;
  if (defaultActor?.isOwner && defaultActor.getFlag(MODULE_ID, PLAYER_VIEW_FLAG)) return defaultActor;
  return game.actors.find((actor) => actor.isOwner && actor.getFlag(MODULE_ID, PLAYER_VIEW_FLAG)) ?? null;
}

function currentPlayerView() {
  return getPlayerActorForCurrentUser()?.getFlag(MODULE_ID, PLAYER_VIEW_FLAG) ?? null;
}

function isSupportedPrizeActor(actor) {
  return ["character", "npc"].includes(actor?.type);
}

function canShowPlayerPanelForActor(actor) {
  return isSupportedPrizeActor(actor) && (isGM() || actor.isOwner);
}

function canOpenPlayerPanelForActor(actor) {
  return canShowPlayerPanelForActor(actor) && (isGM() || Boolean(actor.getFlag(MODULE_ID, PLAYER_VIEW_FLAG)));
}

function addActorSheetPrizeButton(sheet, buttons) {
  const actor = sheet?.actor;
  if (!canShowPlayerPanelForActor(actor) || buttons.some((button) => button.class === "poppys-prize-sheet")) return;
  buttons.unshift({
    label: "Poppy’s Prize",
    class: "poppys-prize-sheet",
    icon: "fa-solid fa-anchor",
    onclick: () => (isGM() ? openTable() : openPlayerPanel(actor)),
  });
}

function actorCopper(actor) {
  return Number(actor?.inventory?.currency?.copperValue ?? 0);
}

async function debitActor(actorId, copper, reason, autoCurrency = hasAutoCurrency()) {
  if (!autoCurrency || copper <= 0) return;
  const actor = getActor(actorId);
  if (!actor?.inventory?.removeCurrency) throw new Error(`${reason}: the linked actor is unavailable or cannot hold PF2E currency.`);
  if (actorCopper(actor) < copper) throw new Error(`${actor.name} lacks the ${formatCopper(copper)} required for ${reason.toLowerCase()}.`);
  const complete = await actor.inventory.removeCurrency(copperToCoins(copper), { byValue: true });
  if (!complete) throw new Error(`${actor.name} could not pay ${formatCopper(copper)} for ${reason.toLowerCase()}.`);
}

async function debitAntes(state, reason) {
  if (!hasAutoCurrency(state) || state.anteCp <= 0) return;
  for (const player of state.players) {
    const actor = getActor(player.actorId);
    if (!actor?.inventory?.removeCurrency) throw new Error(`${player.name} is not linked to an available PF2E PC or NPC actor.`);
    if (actorCopper(actor) < state.anteCp) throw new Error(`${player.name} lacks the ${formatCopper(state.anteCp)} required for ${reason.toLowerCase()}.`);
  }
  for (const player of state.players) await debitActor(player.actorId, state.anteCp, reason, hasAutoCurrency(state));
}

async function settlePayouts(state) {
  if (!hasAutoCurrency(state)) return state;
  const unpaid = (state.payouts ?? []).filter((payout) => payout.copper > 0 && !payout.paid);
  for (const payout of unpaid) {
    const player = getPlayer(state, payout.playerId);
    const actor = getActor(player?.actorId);
    if (!actor?.inventory?.addCurrency) throw new Error(`${player?.name ?? "A winning player"} is not linked to an available PF2E PC or NPC actor for a payout.`);
    await actor.inventory.addCurrency(copperToCoins(payout.copper));
    payout.paid = true;
    await game.settings.set(MODULE_ID, STATE_SETTING, state);
  }
  return state;
}

async function saveState(state) {
  await game.settings.set(MODULE_ID, STATE_SETTING, state);
  await settlePayouts(state);
  await syncPlayerViews(state);
  tableApp?.render({ force: true });
  playerApp?.render({ force: true });
}

function enqueue(action) {
  actionQueue = actionQueue
    .then(async () => action())
    .catch((error) => {
      console.error(`${MODULE_ID} |`, error);
      notify("error", error.message ?? String(error));
    });
  return actionQueue;
}

function actionButton({ action, label, icon = "", dataset = {}, disabled = false, css = "" }) {
  const attributes = Object.entries(dataset).map(([key, value]) => `data-${key}="${escapeHTML(value)}"`).join(" ");
  return `<button type="button" class="pp-button ${css}" data-action="${action}" ${attributes} ${disabled ? "disabled" : ""}>${icon ? `<i class="${icon}"></i> ` : ""}${escapeHTML(label)}</button>`;
}

function cardAssetPath(card) {
  if (card?.image) return `modules/${MODULE_ID}/${card.image}`;
  if (card?.pirate) return `modules/${MODULE_ID}/assets/cards/${card?.id === "c-54" ? "pirate_2" : "pirate_1"}.webp`;
  const rank = card?.rank === "A" ? "01" : card?.rank === "J" ? "jack" : card?.rank === "Q" ? "queen" : card?.rank === "K" ? "king" : String(card?.rank ?? "").padStart(2, "0");
  return `modules/${MODULE_ID}/assets/cards/${card?.suit}_${rank}.webp`;
}

function cardMarkup(card, { selectable = false, action = "", dataset = {}, selected = false, faceDown = false, disabled = false } = {}) {
  const classes = ["pp-card"];
  if (card?.pirate) classes.push("pirate");
  if (faceDown) classes.push("back");
  if (selected) classes.push("selected");
  const attributes = Object.entries(dataset).map(([key, value]) => `data-${key}=\"${escapeHTML(value)}\"`).join(" ");
  const label = faceDown ? "Face-down card" : cardLabel(card);
  const source = faceDown ? `modules/${MODULE_ID}/assets/cards/card_back.webp` : cardAssetPath(card);
  const content = `<img src="${escapeHTML(source)}" alt="${escapeHTML(label)}" draggable="false">`;
  if (!selectable) return `<div class="${classes.join(" ")}" title="${escapeHTML(label)}">${content}</div>`;
  return `<button type="button" class="${classes.join(" ")}" data-action="${action}" ${attributes} title="${escapeHTML(label)}" ${disabled ? "disabled" : ""}>${content}</button>`;
}

function renderCommon(state) {
  const entries = [...state.common].sort((left, right) => left.seat - right.seat);
  return entries.map((entry) => `
    <section class="pp-common-entry ${entry.revealed ? "revealed" : ""}">
      <header>${escapeHTML(entry.name)}${entry.dummy ? " <span class=\"pp-muted\">(dummy)</span>" : ""}</header>
      ${cardMarkup(entry.card, { faceDown: !entry.revealed })}
    </section>`).join("");
}

function renderHand(state, player, gm) {
  if (!gm) return `<div class="pp-private-note">The GM is holding private hands.</div>`;
  if (state.phase === PHASES.SELECT_COMMON && !state.common.some((entry) => entry.playerId === player.id)) {
    return `<div class="pp-hand">${player.hand.map((card) => cardMarkup(card, { selectable: true, action: "select-common", dataset: { player: player.id, card: card.id } })).join("")}</div>`;
  }
  if (state.phase === PHASES.TRANSFER && state.pendingPlunder?.targetId === player.id) {
    const matches = new Set(state.pendingPlunder.matches);
    return `<div class="pp-hand">${player.hand.map((card) => cardMarkup(card, { selectable: matches.has(card.id), action: "transfer", dataset: { player: player.id, card: card.id }, disabled: !matches.has(card.id) })).join("")}</div>`;
  }
  if (state.phase === PHASES.KEEP) {
    const canKeepCommon = state.winners.includes(player.id);
    const current = state.keepers?.[player.id] ?? "";
    const handCards = player.hand.map((card) => cardMarkup(card, { selectable: true, action: "keep", dataset: { player: player.id, card: card.id }, selected: current === card.id }));
    const commonCards = canKeepCommon ? state.common.map((entry) => cardMarkup(entry.card, { selectable: true, action: "keep", dataset: { player: player.id, card: entry.card.id }, selected: current === entry.card.id })) : [];
    const forced = (player.forcedCarry ?? []).map((card) => cardMarkup(card, { selected: true }));
    return `<div class="pp-hand">${[...forced, ...handCards, ...commonCards].join("")}</div>
      <div class="pp-keep-controls">${actionButton({ action: "keep-none", label: "Keep nothing", dataset: { player: player.id } })}</div>`;
  }
  return `<div class="pp-hand">${player.hand.map((card) => cardMarkup(card)).join("")}</div>`;
}

function renderPlayer(state, player, gm) {
  const active = getCurrentActor(state) === player.id;
  const waitingCommon = state.phase === PHASES.SELECT_COMMON && !state.common.some((entry) => entry.playerId === player.id);
  const showing = state.lastShowdown?.scores?.[player.id];
  const keep = state.keepers?.[player.id];
  return `<section class="pp-player ${player.folded ? "folded" : ""} ${active ? "active" : ""}">
    <header>
      <div><strong>${escapeHTML(player.name)}</strong> ${player.seat === state.dealerSeat ? "<span class=\"pp-dealer\">Poppy</span>" : ""}</div>
      <div class="pp-player-status">${player.folded ? "Folded" : active ? "To act" : waitingCommon ? "Choose common card" : "In game"}</div>
    </header>
    <div class="pp-player-meta"><span>Contributed: ${escapeHTML(formatCopper(player.contributionCp))}</span>${showing ? `<span>Showdown: ${escapeHTML(showing.name)}</span>` : ""}${keep ? "<span>Card kept</span>" : ""}</div>
    ${renderHand(state, player, gm)}
  </section>`;
}

function renderBettingControls(state) {
  if (state.phase !== PHASES.BETTING || !state.betting) return "";
  const currentId = getCurrentActor(state);
  const player = getPlayer(state, currentId);
  if (!player) return "";
  const currentBet = state.betting.currentBet;
  const paid = state.betting.roundBets[player.id] ?? 0;
  const callCost = Math.max(0, currentBet - paid);
  const minimumRaise = currentBet === 0 ? state.anteCp : currentBet + state.betting.minRaise;
  return `<section class="pp-control-panel"><h3>${escapeHTML(player.name)}’s betting turn</h3>
    <div class="pp-action-row">
      ${currentBet === 0 ? actionButton({ action: "bet", label: "Pass", dataset: { player: player.id, type: "pass" } }) : actionButton({ action: "bet", label: `Call ${formatCopper(callCost)}`, dataset: { player: player.id, type: "call" } })}
      ${actionButton({ action: "bet", label: "Fold", css: "danger", dataset: { player: player.id, type: "fold" } })}
    </div>
    <div class="pp-raise-row">
      <label>Raise to <input id="pp-raise-cp" type="number" min="${minimumRaise}" step="1" value="${minimumRaise}"> <span>cp</span></label>
      ${actionButton({ action: "raise", label: "Raise", dataset: { player: player.id } })}
    </div>
    <p class="pp-help">Current bet: <strong>${formatCopper(currentBet)}</strong>. A new bet must be at least ${formatCopper(minimumRaise)}.</p>
  </section>`;
}

function renderPlunderControls(state) {
  if (state.phase === PHASES.TRANSFER && state.pendingPlunder) {
    const target = getPlayer(state, state.pendingPlunder.targetId);
    return `<section class="pp-control-panel"><h3>Choose a card to surrender</h3><p>${escapeHTML(target?.name)} must choose one card matching the Pirate’s demand.</p></section>`;
  }
  if (state.phase !== PHASES.PLUNDER || !state.plunder) return "";
  const pirateId = getCurrentActor(state);
  const pirate = getPlayer(state, pirateId);
  const targets = state.players.filter((player) => player.id !== pirateId && !state.plunder.queue.some((entry) => entry.playerId === player.id));
  return `<section class="pp-control-panel"><h3>${escapeHTML(pirate?.name)}’s Pirate card</h3>
    <div class="pp-plunder-fields">
      <label>Target <select id="pp-plunder-target">${targets.map((player) => `<option value="${escapeHTML(player.id)}">${escapeHTML(player.name)}</option>`).join("")}</select></label>
      <label>Suit <select id="pp-plunder-suit"><option value="">Any suit</option>${RULE_DATA.suits.map((suit) => `<option value="${suit.id}">${suit.label}</option>`).join("")}</select></label>
      <label>Value <select id="pp-plunder-rank"><option value="">Any value</option>${RULE_DATA.ranks.map((rank) => `<option value="${rank.rank}">${rank.label}</option>`).join("")}</select></label>
    </div>
    <div class="pp-action-row">
      ${actionButton({ action: "plunder", label: "Plunder", dataset: { player: pirateId } })}
      ${actionButton({ action: "skip-plunder", label: "Do not Plunder", dataset: { player: pirateId }, css: "muted" })}
    </div>
  </section>`;
}

function renderStartState() {
  return `<section class="pp-empty"><h2>Poppy’s Prize table</h2><p>No game is currently open. The GM can assign up to four PF2E PC or NPC actors, with any unused seat set to - Dummy.</p>${actionButton({ action: "new-game", label: "Start a game", icon: "fa-solid fa-anchor" })}</section>`;
}

function renderControls(state) {
  if (!isGM()) return "<p class=\"pp-viewer-note\">This is a GM-led table. Ask the GM to record a game action.</p>";
  if (state.phase === PHASES.BETTING) return renderBettingControls(state);
  if (state.phase === PHASES.PLUNDER || state.phase === PHASES.TRANSFER) return renderPlunderControls(state);
  if (state.phase === PHASES.KEEP) return "<section class=\"pp-control-panel\"><h3>Keep one card</h3><p>Choose a card in each player’s hand, or use <em>Keep nothing</em>. A round winner may also choose from the common pool.</p></section>";
  if (state.phase === PHASES.COMPLETE) return `<section class="pp-control-panel"><h3>Round complete</h3><p>All players have made their carry-over choices.</p><div class="pp-action-row">${actionButton({ action: "next-game", label: "Deal next game", icon: "fa-solid fa-dice" })}${actionButton({ action: "clear-game", label: "Close table", css: "danger" })}</div></section>`;
  return `<section class="pp-control-panel"><h3>Common cards</h3><p>Each player must choose one face-down card. The dealer’s card will be revealed first.</p></section>`;
}

function renderTable(state) {
  if (!state) return renderStartState();
  const current = getCurrentActor(state);
  const actorText = current ? `${playerName(state, current)} to act` : state.phase === PHASES.COMPLETE ? "Ready for the next game" : "Awaiting selections";
  const payoutText = (state.payouts ?? []).filter((payout) => payout.copper > 0).map((payout) => `${escapeHTML(playerName(state, payout.playerId))}: ${escapeHTML(formatCopper(payout.copper))}${hasAutoCurrency(state) && payout.paid ? " (paid)" : ""}`).join(" · ");
  return `<div class="pp-table">
    <header class="pp-banner"><div><h2>Poppy’s Prize</h2><p>Game ${state.gameNumber} · ${escapeHTML(actorText)}</p></div><div class="pp-pot"><span>Pot</span><strong>${escapeHTML(formatCopper(state.potCp))}</strong><small>Ante: ${escapeHTML(formatCopper(state.anteCp))}</small></div></header>
    <section class="pp-common"><h3>Common pool</h3><div class="pp-common-cards">${renderCommon(state)}</div></section>
    ${payoutText ? `<p class="pp-payout">Payout: ${payoutText}</p>` : ""}
    <section class="pp-players">${state.players.map((player) => renderPlayer(state, player, isGM())).join("")}</section>
    ${renderControls(state)}
    <footer class="pp-footer"><span>Phase: ${escapeHTML(state.phase.replaceAll("-", " "))}</span>${isGM() ? actionButton({ action: "clear-game", label: "Reset table", css: "text" }) : ""}</footer>
  </div>`;
}

function renderPlayerCommon(board) {
  return board.common.slice().sort((left, right) => left.seat - right.seat).map((entry) => `<section class="pp-common-entry ${entry.revealed ? "revealed" : ""}">
    <header>${escapeHTML(entry.name)}${entry.dummy ? " <span class=\"pp-muted\">(dummy)</span>" : ""}</header>
    ${cardMarkup(entry.card, { faceDown: !entry.revealed })}
  </section>`).join("");
}

function renderPlayerHand(view) {
  const { board, player, choices } = view;
  const transferMatches = new Set(choices.transferMatches);
  const selectedKeep = player.selectedKeep || "";
  const cards = player.hand.map((card) => {
    if (choices.canSelectCommon) return cardMarkup(card, { selectable: true, action: "player-select-common", dataset: { card: card.id } });
    if (choices.canTransfer) return cardMarkup(card, { selectable: transferMatches.has(card.id), action: "player-transfer", dataset: { card: card.id }, disabled: !transferMatches.has(card.id) });
    if (choices.canKeep) return cardMarkup(card, { selectable: true, action: "player-keep", dataset: { card: card.id }, selected: selectedKeep === card.id });
    return cardMarkup(card);
  });
  const forced = player.forcedCarry.map((card) => cardMarkup(card, { selected: true }));
  const common = choices.keepCommon ? board.common.filter((entry) => entry.card).map((entry) => cardMarkup(entry.card, { selectable: true, action: "player-keep", dataset: { card: entry.card.id }, selected: selectedKeep === entry.card.id })) : [];
  return `<div class="pp-hand">${[...forced, ...cards, ...common].join("")}</div>`;
}

function renderPlayerActions(view) {
  const { board, player, choices } = view;
  if (choices.canSelectCommon) return `<section class="pp-control-panel"><h3>Choose your common card</h3><p>Select one card from your hand. It remains face-down until the reveal.</p></section>`;
  if (choices.canBet && board.betting) {
    const currentBet = board.betting.currentBet;
    const paid = board.betting.roundBets[player.id] ?? 0;
    const callCost = Math.max(0, currentBet - paid);
    const minimumRaise = currentBet === 0 ? board.anteCp : currentBet + board.betting.minRaise;
    return `<section class="pp-control-panel"><h3>Your betting turn</h3>
      <div class="pp-action-row">
        ${currentBet === 0 ? actionButton({ action: "player-bet", label: "Pass", dataset: { type: "pass" } }) : actionButton({ action: "player-bet", label: `Call ${formatCopper(callCost)}`, dataset: { type: "call" } })}
        ${actionButton({ action: "player-bet", label: "Fold", css: "danger", dataset: { type: "fold" } })}
      </div>
      <div class="pp-raise-row"><label>Raise to <input id="pp-player-raise-cp" type="number" min="${minimumRaise}" step="1" value="${minimumRaise}"> <span>cp</span></label>${actionButton({ action: "player-raise", label: "Raise" })}</div>
      <p class="pp-help">Current bet: <strong>${formatCopper(currentBet)}</strong>. A new bet must be at least ${formatCopper(minimumRaise)}.</p>
    </section>`;
  }
  if (choices.canPlunder) return `<section class="pp-control-panel"><h3>Use your Pirate card</h3>
    <div class="pp-plunder-fields">
      <label>Target <select id="pp-player-plunder-target">${choices.plunderTargets.map((target) => `<option value="${escapeHTML(target.id)}">${escapeHTML(target.name)}</option>`).join("")}</select></label>
      <label>Suit <select id="pp-player-plunder-suit"><option value="">Any suit</option>${RULE_DATA.suits.map((suit) => `<option value="${suit.id}">${suit.label}</option>`).join("")}</select></label>
      <label>Value <select id="pp-player-plunder-rank"><option value="">Any value</option>${RULE_DATA.ranks.map((rank) => `<option value="${rank.rank}">${rank.label}</option>`).join("")}</select></label>
    </div>
    <div class="pp-action-row">${actionButton({ action: "player-plunder", label: "Plunder" })}${actionButton({ action: "player-skip-plunder", label: "Do not Plunder", css: "muted" })}</div>
  </section>`;
  if (choices.canTransfer) return `<section class="pp-control-panel"><h3>Choose a card to surrender</h3><p>Select one highlighted matching card from your hand.</p></section>`;
  if (choices.canKeep) return `<section class="pp-control-panel"><h3>Choose your carry-over card</h3><p>Select one card to keep for the next game, or keep nothing. A round winner may also select a common card.</p>${actionButton({ action: "player-keep-none", label: "Keep nothing", css: "muted" })}</section>`;
  if (board.phase === PHASES.COMPLETE) return `<section class="pp-control-panel"><h3>Round complete</h3><p>Await the GM to begin the next game.</p></section>`;
  return `<section class="pp-control-panel"><h3>Waiting for another player</h3><p>Your choices will appear here when it is your turn.</p></section>`;
}

function renderPlayerPanel(view) {
  if (!view) return `<section class="pp-empty"><h2>Poppy’s Prize</h2><p>You are not assigned to an active Poppy’s Prize table. Ask the GM to select an actor you own when starting the game.</p></section>`;
  const { board, player } = view;
  const status = getPlayerActorForCurrentUser()?.getFlag(MODULE_ID, PLAYER_STATUS_FLAG);
  const currentPlayer = board.players.find((entry) => entry.id === board.currentActorId);
  const actionText = currentPlayer ? `${currentPlayer.name} is acting` : board.phase === PHASES.COMPLETE ? "Round complete" : "Awaiting selections";
  const payout = board.payouts.find((entry) => entry.playerId === player.id && entry.copper > 0);
  return `<div class="pp-table pp-player-table">
    <header class="pp-banner"><div><h2>Poppy’s Prize</h2><p>Game ${board.gameNumber} · ${escapeHTML(actionText)}</p></div><div class="pp-pot"><span>Pot</span><strong>${escapeHTML(formatCopper(board.potCp))}</strong><small>Ante: ${escapeHTML(formatCopper(board.anteCp))}</small></div></header>
    <section class="pp-common"><h3>Common pool</h3><div class="pp-common-cards">${renderPlayerCommon(board)}</div></section>
    ${payout ? `<p class="pp-payout">Your payout: ${escapeHTML(formatCopper(payout.copper))}${board.autoCurrency && payout.paid ? " (paid)" : ""}</p>` : ""}
    ${status?.message ? `<p class="pp-player-message ${escapeHTML(status.kind ?? "")}">${escapeHTML(status.message)}</p>` : ""}
    <section class="pp-player active"><header><div><strong>${escapeHTML(player.name)}</strong>${player.seat === board.dealerSeat ? " <span class=\"pp-dealer\">Poppy</span>" : ""}</div><div class="pp-player-status">${player.folded ? "Folded" : board.currentActorId === player.id ? "Your turn" : "In game"}</div></header><div class="pp-player-meta"><span>Contributed: ${escapeHTML(formatCopper(player.contributionCp))}</span>${player.showdown ? `<span>Showdown: ${escapeHTML(player.showdown.name)}</span>` : ""}</div>${renderPlayerHand(view)}</section>
    ${renderPlayerActions(view)}
    <footer class="pp-footer"><span>Phase: ${escapeHTML(board.phase.replaceAll("-", " "))}</span><span>Your hand is private.</span></footer>
  </div>`;
}

class PoppysPrizeApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "poppys-prize-table",
    classes: ["poppys-prize", "application"],
    position: { width: 980, height: "auto" },
    window: { title: "Poppy’s Prize", icon: "fa-solid fa-anchor", resizable: true },
  };

  async _renderHTML() {
    const element = document.createElement("div");
    element.innerHTML = renderTable(currentState());
    return element;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", (event) => this.#onAction(event));
    });
  }

  #onAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (!isGM() && action !== "") return notify("warn", "Poppy’s Prize is GM-led. Ask the GM to record this action.");
    if (action === "new-game") return promptStartGame();
    if (action === "clear-game") return clearGame();
    if (action === "select-common") return enact((state) => selectCommon(state, button.dataset.player, button.dataset.card));
    if (action === "bet") return enact(async (state) => {
      const result = bettingAction(state, button.dataset.player, button.dataset.type);
      await debitActor(result.debitPlayerId, result.debitCp, "this bet", hasAutoCurrency(state));
      return result.state;
    });
    if (action === "raise") return enact(async (state) => {
      const amount = Number(this.element.querySelector("#pp-raise-cp")?.value);
      const result = bettingAction(state, button.dataset.player, "raise", amount);
      await debitActor(result.debitPlayerId, result.debitCp, "this raise", hasAutoCurrency(state));
      return result.state;
    });
    if (action === "plunder") return enact((state) => plunder(state, button.dataset.player, {
      targetId: this.element.querySelector("#pp-plunder-target")?.value,
      suit: this.element.querySelector("#pp-plunder-suit")?.value || null,
      rank: this.element.querySelector("#pp-plunder-rank")?.value || null,
    }));
    if (action === "skip-plunder") return enact((state) => declinePlunder(state, button.dataset.player));
    if (action === "transfer") return enact((state) => choosePlunderTransfer(state, button.dataset.player, button.dataset.card));
    if (action === "keep") return enact((state) => chooseKeep(state, button.dataset.player, button.dataset.card));
    if (action === "keep-none") return enact((state) => chooseKeep(state, button.dataset.player, null));
    if (action === "next-game") return nextGame();
  }
}

class PoppysPrizePlayerApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "poppys-prize-player",
    classes: ["poppys-prize", "application", "poppys-prize-player"],
    position: { width: 760, height: "auto" },
    window: { title: "Poppy’s Prize — Your Hand", icon: "fa-solid fa-anchor", resizable: true },
  };

  async _renderHTML() {
    const element = document.createElement("div");
    element.innerHTML = renderPlayerPanel(currentPlayerView());
    return element;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", (event) => this.#onAction(event));
    });
  }

  #onAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (action === "player-select-common") return submitPlayerRequest("select-common", { cardId: button.dataset.card });
    if (action === "player-transfer") return submitPlayerRequest("transfer", { cardId: button.dataset.card });
    if (action === "player-keep") return submitPlayerRequest("keep", { cardId: button.dataset.card });
    if (action === "player-keep-none") return submitPlayerRequest("keep-none");
    if (action === "player-bet") return submitPlayerRequest("bet", { type: button.dataset.type });
    if (action === "player-raise") return submitPlayerRequest("raise", { amountCp: Number(this.element.querySelector("#pp-player-raise-cp")?.value) });
    if (action === "player-plunder") return submitPlayerRequest("plunder", {
      targetId: this.element.querySelector("#pp-player-plunder-target")?.value,
      suit: this.element.querySelector("#pp-player-plunder-suit")?.value || null,
      rank: this.element.querySelector("#pp-player-plunder-rank")?.value || null,
    });
    if (action === "player-skip-plunder") return submitPlayerRequest("skip-plunder");
    return null;
  }
}

function openPlayerPanel(actor = null) {
  if (isGM()) return openTable();
  const target = actor ?? getPlayerActorForCurrentUser();
  if (!target || !canOpenPlayerPanelForActor(target)) return notify("warn", "This actor is not assigned to an active Poppy’s Prize table. Ask the GM to select an actor you own when starting the game.");
  playerApp ??= new PoppysPrizePlayerApplication();
  playerApp.actorId = target.id;
  return playerApp.render({ force: true });
}

async function submitPlayerRequest(action, payload = {}) {
  const actor = getPlayerActorForCurrentUser();
  const view = actor?.getFlag(MODULE_ID, PLAYER_VIEW_FLAG);
  if (!actor || !view) return notify("warn", "You are not assigned to an active Poppy’s Prize table.");
  await actor.setFlag(MODULE_ID, PLAYER_STATUS_FLAG, { kind: "pending", message: "Action sent to the GM for validation." });
  await actor.setFlag(MODULE_ID, PLAYER_REQUEST_FLAG, { id: foundry.utils.randomID(), action, payload, requestedAt: Date.now() });
  playerApp?.render({ force: true });
}

async function processPlayerRequest(actor, request, userId) {
  if (!isPrimaryGM() || !request?.id || !request?.action) return;
  const user = game.users.get(userId);
  if (!user || user.isGM || !actor.testUserPermission(user, "OWNER")) return;
  return enqueue(async () => {
    const state = currentState();
    const player = getPlayerForActor(state, actor.id);
    const reject = async (message) => actor.setFlag(MODULE_ID, PLAYER_STATUS_FLAG, { kind: "error", message });
    if (!state || !player) return reject("You are not assigned to the active Poppy’s Prize table.");
    try {
      let next;
      if (request.action === "select-common") next = selectCommon(state, player.id, request.payload?.cardId);
      else if (request.action === "bet") {
        const result = bettingAction(state, player.id, request.payload?.type);
        await debitActor(result.debitPlayerId, result.debitCp, "this bet", hasAutoCurrency(state));
        next = result.state;
      } else if (request.action === "raise") {
        const result = bettingAction(state, player.id, "raise", Number(request.payload?.amountCp));
        await debitActor(result.debitPlayerId, result.debitCp, "this raise", hasAutoCurrency(state));
        next = result.state;
      } else if (request.action === "plunder") next = plunder(state, player.id, request.payload ?? {});
      else if (request.action === "skip-plunder") next = declinePlunder(state, player.id);
      else if (request.action === "transfer") next = choosePlunderTransfer(state, player.id, request.payload?.cardId);
      else if (request.action === "keep") next = chooseKeep(state, player.id, request.payload?.cardId);
      else if (request.action === "keep-none") next = chooseKeep(state, player.id, null);
      else throw new Error("Unknown player action.");
      await actor.unsetFlag(MODULE_ID, PLAYER_REQUEST_FLAG);
      await actor.setFlag(MODULE_ID, PLAYER_STATUS_FLAG, { kind: "success", message: "Action recorded." });
      await saveState(next);
    } catch (error) {
      console.warn(`${MODULE_ID} | rejected player request`, error);
      await actor.unsetFlag(MODULE_ID, PLAYER_REQUEST_FLAG);
      await reject(error.message ?? "The action could not be recorded.");
    }
  });
}

function openTable() {
  if (!isGM()) {
    notify("warn", "Poppy’s Prize is a GM-led table. Ask the GM to open and record the game.");
    return null;
  }
  tableApp ??= new PoppysPrizeApplication();
  return tableApp.render({ force: true });
}

async function enact(transform) {
  return enqueue(async () => {
    if (!isGM()) throw new Error("Only a GM may record Poppy’s Prize actions.");
    const state = currentState();
    if (!state) throw new Error("There is no active Poppy’s Prize game.");
    const next = await transform(state);
    await saveState(next);
  });
}

async function nextGame() {
  return enqueue(async () => {
    const state = currentState();
    if (!state || state.phase !== PHASES.COMPLETE) throw new Error("Finish all keep choices before dealing the next game.");
    await debitAntes(state, "the next game’s ante");
    await saveState(dealNextGame(state));
  });
}

function promptStartGame() {
  const actors = getParticipantActors();
  if (actors.length < 2) return notify("warn", "Create or import at least two PF2E PC or NPC actors before starting Poppy’s Prize.");
  const { partyMembers, otherActors } = getParticipantActorGroups();
  const optionsFor = (entries) => entries.map((actor) => `<option value="${escapeHTML(actor.id)}">${escapeHTML(actor.name)}</option>`).join("");
  const actorOptions = `<option value="" selected>- Dummy</option>${partyMembers.length ? `<optgroup label="Party Members">${optionsFor(partyMembers)}</optgroup>` : ""}${otherActors.length ? `<optgroup label="Other Actors">${optionsFor(otherActors)}</optgroup>` : ""}`;
  const seats = Array.from({ length: 4 }, (_entry, index) => `<label>Character ${index + 1}<select name="seat-${index + 1}" data-seat>${actorOptions}</select></label>`).join("");
  const content = `<form class="pp-start-form">
    <p>Choose an actor for each of the four seats. Any seat left as <strong>- Dummy</strong> supplies only a common card.</p>
    <div class="pp-seat-selectors">${seats}</div>
    <div class="pp-start-stakes">
      <label>Ante <input name="ante" type="number" min="0" step="0.01" value="5"></label>
      <label>Denomination <select name="denomination"><option value="gp">gp</option><option value="sp">sp</option><option value="cp">cp</option><option value="pp">pp</option></select></label>
    </div>
    <label class="pp-currency-choice"><input name="automaticCurrency" type="checkbox"> Automatically transfer PF2E currency</label>
    <p class="notes">When selected, the chosen actors pay antes and bets automatically and receive automatic payouts for this game. Leave it unchecked for narrative or manual wealth tracking.</p>
  </form>`;
  new foundry.applications.api.DialogV2({
    window: { title: "Start Poppy’s Prize" },
    content,
    buttons: [{
      action: "start",
      label: "Deal cards",
      icon: "fa-solid fa-dice",
      default: true,
      callback: (_event, button) => {
        const form = button.form;
        return {
          actorIds: [...form.querySelectorAll("select[data-seat]")].map((select) => select.value).filter(Boolean),
          ante: Number(form.elements.ante.value),
          denomination: form.elements.denomination.value,
          autoCurrency: form.elements.automaticCurrency.checked,
        };
      },
    }],
    submit: (result) => startGame(result),
  }).render({ force: true });
}

async function startGame(result) {
  return enqueue(async () => {
    if (!result) return;
    if (!Number.isFinite(result.ante) || result.ante < 0) throw new Error("Enter a non-negative ante.");
    if (result.actorIds.length < 2 || result.actorIds.length > 4) throw new Error("Select between two and four PC or NPC actors.");
    if (new Set(result.actorIds).size !== result.actorIds.length) throw new Error("Choose each PC or NPC actor only once.");
    const multipliers = { cp: 1, sp: 10, gp: 100, pp: 1000 };
    const anteCp = Math.round(result.ante * (multipliers[result.denomination] ?? 1));
    if (!Number.isSafeInteger(anteCp)) throw new Error("The ante is too large.");
    const participants = result.actorIds.map((actorId) => {
      const actor = getActor(actorId);
      if (!actor) throw new Error("One of the chosen actors is no longer available.");
      return { id: actor.id, actorId: actor.id, name: actor.name };
    });
    const state = createGame({ participants, anteCp });
    state.autoCurrency = result.autoCurrency === true;
    await debitAntes(state, "the opening ante");
    await saveState(state);
    openTable();
  });
}

function clearGame() {
  if (!isGM()) return;
  return foundry.applications.api.DialogV2.confirm({
    window: { title: "Reset Poppy’s Prize table" },
    content: "<p>Close the current table? This clears the stored game and player-view data; it does not refund or change any character currency.</p>",
    yes: { label: "Close table", icon: "fa-solid fa-trash" },
    no: { label: "Keep playing" },
  }).then((confirmed) => {
    if (confirmed) return enqueue(async () => {
      const state = currentState();
      await clearPlayerViews(state);
      await game.settings.set(MODULE_ID, STATE_SETTING, null);
      tableApp?.render({ force: true });
      playerApp?.render({ force: true });
    });
    return null;
  });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, STATE_SETTING, {
    name: "Poppy’s Prize table state",
    hint: "Internal world state for an active Poppy’s Prize game.",
    scope: "world",
    config: false,
    restricted: true,
    type: Object,
    default: null,
  });
  game.settings.register(MODULE_ID, PUBLIC_STATE_SETTING, {
    name: "Poppy’s Prize public board",
    hint: "Public game data with no private hands or face-down card identities.",
    scope: "world",
    config: false,
    restricted: false,
    type: Object,
    default: null,
  });
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({ open: openTable, openPlayer: openPlayerPanel, start: promptStartGame, clear: clearGame });
  Hooks.on("getActorSheetHeaderButtons", addActorSheetPrizeButton);
  Hooks.on("getCharacterSheetPF2eHeaderButtons", addActorSheetPrizeButton);
  Hooks.on("getNPCSheetPF2eHeaderButtons", addActorSheetPrizeButton);
  Hooks.on("getApplicationHeaderButtons", addActorSheetPrizeButton);
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.find((control) => control.name === "token");
    if (!tokenControls || tokenControls.tools.some((tool) => tool.name === "poppys-prize")) return;
    tokenControls.tools.push({
      name: "poppys-prize",
      title: isGM() ? "Poppy’s Prize table" : "Poppy’s Prize — Your Hand",
      icon: "fa-solid fa-anchor",
      button: true,
      visible: true,
      onClick: () => (isGM() ? openTable() : openPlayerPanel()),
    });
  });
  Hooks.on("updateSetting", (setting) => {
    if (setting.key === `${MODULE_ID}.${STATE_SETTING}` && tableApp?.rendered) tableApp.render({ force: true });
    if (setting.key === `${MODULE_ID}.${PUBLIC_STATE_SETTING}` && playerApp?.rendered) playerApp.render({ force: true });
  });
  Hooks.on("updateActor", (actor, changed, _options, userId) => {
    const changedFlags = changed.flags?.[MODULE_ID] ?? {};
    const request = changedFlags[PLAYER_REQUEST_FLAG];
    if (request) processPlayerRequest(actor, request, userId);
    if (playerApp?.rendered && actor.id === getPlayerActorForCurrentUser()?.id && (changedFlags[PLAYER_VIEW_FLAG] !== undefined || changedFlags[PLAYER_STATUS_FLAG] !== undefined)) playerApp.render({ force: true });
  });
  if (game.system.id !== "pf2e") console.warn(`${MODULE_ID} | This module requires the PF2E system.`);
});
