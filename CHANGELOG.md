# Changelog

All notable changes to **PF2e Tavern Games**, including its Poppy’s Prize game, are documented in this file.

## 2.1.6 — 28 August 2026

Golem now uses the supplied `golem_deck_complete.zip` art set: 52 numbered PNG face cards across Flesh, Clay, Stone, and Iron, together with `golem_card_back.png` for every concealed Golem card. The prior standard-suit dark-gold WebP deck and the unused joker are no longer bundled or referenced. Golem’s poker scoring remains unchanged; its displayed ranks now match the supplied 1–13 artwork.

## 2.1.5 — 28 August 2026

The GitHub README now includes a dedicated Foundry **Install Module** walkthrough using the canonical manifest URL. It explains the Game Worlds → Add-on Modules → Install Module flow, where to paste the Manifest URL, world enablement, the legacy package migration, and manual ZIP installation when the private GitHub repository is not reachable by the Foundry server.

## 2.1.4 — 28 August 2026

Golem now renders every dealt card in both the GM table and player hand with the supplied dark-gold standard-card artwork. Concealed Golem cards, including the deck owner’s marked-card sight, use the matching supplied `back.webp` image. The unused `joker.webp` is excluded from the module’s Golem assets and cannot enter the 52-card Golem deck.

## 2.1.3 — 28 August 2026

The module-use Journal Entry and README now include a dedicated, step-by-step **Dealer social cheating** guide. It distinguishes universal Poppy and Golem Dealer hand selection from item-gated marked-card sight, explains the blind Performance or Deception — Create a Diversion roll, and documents the observer-specific detection and whisper outcome.

The test suite now includes a mocked PF2E actor integration test for the Drinking Contest. It verifies automated effects and conditions across Stages 1–6, ten-minute and eight-hour durations, fear-save bonus rules, stage replacement, Stage 6 unconsciousness, cleanup, and preservation of a pre-existing stronger condition.

## 2.1.2 — 28 August 2026

Any active **Poppy’s Prize Poppy** or **Golem Dealer** can now elect to cheat by selecting every card needed to complete their own hand and choosing a blind **Performance** or **Deception — Create a Diversion** concealment check. The selected hand remains subject to the existing observer-by-observer Perception DC comparison and failure-only GM/observer whispers.

The item requirement remains strictly scoped to the additional equipment benefits: `marked-playing-cards` is still required for marked-card sight and the special two-card first-hand choice, while `games-loaded-dice` remains required for Bounder and Century result selection.

## 2.1.1 — 28 August 2026

Equipment-based cheating is now strictly offered only to the role-holder who possesses the corresponding inventory item. **Marked-card sight** and opening-card selection appear only for the current Poppy or Golem Dealer/deck owner with `marked-playing-cards`; **Bounder** result selection appears only for the qualifying Shooter with `games-loaded-dice`; and **Century** result selection appears only for the qualifying Dealer with `games-loaded-dice`.

Poppy’s Prize, Golem, and Drinking Contest cheating now requires the actor to choose a blind **Performance** check or blind **Deception — Create a Diversion** check. The selected result is compared independently with every other qualified participant’s Perception DC. A failure or critical failure sends the established suspicion whispers to the active GM and the observing actor’s active Owners; success and critical success send none. The old Palm an Object check is no longer used for those cheating workflows.

## 2.1.0 — 28 August 2026

The **PF2e Tavern Games Journals** compendium now contains six distinct Journal Entries: dedicated rules references for **Poppy’s Prize**, **Golem**, **Bounder**, **Century**, and the **Drinking Contest**, plus **How to Use PF2e Tavern Games**. Each game reference includes its creator credit and source acknowledgement where applicable. The module-use guide now links the cheating equipment labels to the requested `@UUID[Compendium.pf2e.equipment-srd.Item.Q4KkKGGXq4bNGHh2]` compendium item syntax.

Golem, Bounder, Century, and Drinking Contest setup is now a two-step flow. The GM first selects the participant count, then completes an individual selector for every participant. Each selector is ordered exactly as Poppy’s Prize: **- Dummy** first, active **Party Members** alphabetically, then all other eligible PC and NPC actors alphabetically. After a count is chosen, every selector requires a distinct real actor; a dummy cannot be used to bypass the selected count.

## 2.0.0 — 28 August 2026

PF2e Tavern Games is now a multi-game library. It adds **Golem**, **Bounder**, **Century**, and a configurable **Drinking Contest** alongside the existing Poppy’s Prize table. Each added game provides an authoritative GM table, actor-owned player controls, the shared activity log, and a GM **Disqualify** control. Poppy’s Prize now also exposes a confirmed GM disqualification control that safely removes a participant’s pending action.

Golem implements its 52-card, three-to-six player poker game, including ante, amulet-led betting, discards into the golem hand, the house’s 5% share, continuation after a non-winning showdown, and amulet rotation. A Golem Dealer with `marked-playing-cards` can select two opening cards on the first hand and use private marked-card sight; the blind Palm an Object detection procedure mirrors Poppy’s Prize.

Bounder implements Shooter points, optional double stakes, point/all-odd/all-even/three-of-a-kind bets, the dealer’s 3d6 total, bracketing d20 result, payouts, and Shooter rotation. A qualifying Shooter with `games-loaded-dice` can select either d20 result. Century implements 2–10 selections from 1–100, twenty distinct Dealer results, the official payout matrix, and Dealer loaded-dice result selection when the Dealer has `games-loaded-dice`.

The Drinking Contest resolves a simultaneous round after every qualified actor has pressed Ready. The module posts blind-to-GM Performance and Fortitude checks, compares saves to the GM’s configured DC, applies or updates module-tracked PF2E conditions and timed effects for the six named stages, and eliminates contestants at Stage 6. Any contestant can cheat for an automatic Fortitude success; their blind Performance result is tested independently against every other contestant’s Perception DC, whispering only the GM and observers who detect the cheat.

The bundled macro is now **Open PF2e Tavern Games**, and the Journals pack now contains a multi-game rules reference and expanded module-use guide. Golem, Bounder, and Century acknowledge *Pathfinder #159: All or Nothing* and [Archives of Nethys](https://2e.aonprd.com/Rules.aspx?ID=1452) as their source.

## 1.9.0 — 28 August 2026

The Foundry package ID is now `pf2e-tavern-games`, matching the module and GitHub repository names. The release uses the matching `Data/modules/pf2e-tavern-games/` directory and a clean `pf2e-tavern-games.*` compendium namespace, eliminating the duplicate Rules Reference left behind by the former package. On its first GM load, the module copies legacy `poppys-prize` table state, public board data, and actor-owned player views into the new namespace; the retired module must not be enabled at the same time.

## 1.8.0 — 28 August 2026

The Macro and JournalEntry packs now use fresh `pf2e-tavern-games-*` IDs and paths, resolving the stale Poppy’s Prize parent-folder cache and duplicate Rules Reference presentation. The active GM migrates only the retired module pack configuration into the **PF2e Tavern Games** folder without resetting unrelated compendium organisation. The two bundled Journal Entries now acknowledge that Poppy’s Prize originates in *Jewel of the Indigo Isles*.

## 1.7.1 — 28 August 2026

The private GitHub repository is now **tatsumasagc/pf2e-tavern-games**. The manifest, update manifest URL, versioned download URL, README, and release asset name now use the renamed repository. The Foundry package ID remains `poppys-prize` for installed-world compatibility.

## 1.7.0 — 28 August 2026

The module’s visible identity is now **PF2e Tavern Games**. Its existing game remains **Poppy’s Prize**, and the Macro and Journal packs have been relabelled and moved under the **PF2e Tavern Games** compendium folder. The stable package ID `poppys-prize`, data keys, asset paths, and repository location are retained so existing installations and saved active tables continue to work after the update.

## 1.6.1 — 27 August 2026

In a later game at the same table, the active Poppy can now elect to use `marked-playing-cards` for private marked-card sight when their actor has that item. This exposes grouped hidden hands and the unrevealed common pool only to that Poppy; it does not permit later-game selection of two opening cards.

## 1.6.0 — 27 August 2026

The manifest author is now **Tatsu_Gamer**. The Poppy’s Prize compendium folder now also contains a player-readable **Poppy’s Prize Journals** pack with two Journal Entries: **Poppy’s Prize — Rules Reference** and **How to Use the Poppy’s Prize Module**. Both entries include the creator note: *Created by Tatsu_Gamer using Manus AI*.

## 1.5.2 — 27 August 2026

Marked-card sight now groups concealed cards into a named hidden-hand section for each other participant plus a separate **Common pool** section. Each identity remains directly above the matching card-back image. The Palm an Object check is now a blind, no-DC GM roll, followed by individual degree-of-success comparisons against each observer’s Perception DC. On a failed comparison, the observer’s active Owner receives the suspicion whisper and the GM receives a matching audit whisper that names the observer.

## 1.5.1 — 27 August 2026

When the first Poppy actually uses marked playing cards, their actor-owned player panel now shows a **Marked-card sight** section. It displays the text identity above the card-back image for every other participant’s face-down hand card and every unrevealed common card. This private visibility is never written to the public board or another actor’s player view, and it expires when the next game is prepared.

## 1.5.0 — 27 August 2026

This feature release adds a GM **Open player panel** control for each participant, an independently scrollable player window, high-contrast phase-guide titles, and prominent in-client turn alerts that open the active participant’s panel. Completed rounds now announce the winner or split winners, every payout, the winning hand, and its five scoring cards to the shared chat.

The setup dialogue now asks the GM to designate a participating deck owner as the first Poppy/Dealer and accepts all antes in separate whole-number **pp**, **gp**, **sp**, and **cp** fields. The table is prepared before cards or antes are dealt; Poppy must use **Deal cards** to begin the game, and the same staged action applies to later games.

On the first game, an actor with an inventory item slugged `marked-playing-cards` may use marked cards to choose two opening-hand cards. The module makes a secret PF2E `action: "palm-an-object"` Thievery check against the other participants’ Perception DCs for every first deal. A failed cheating attempt whispers suspicion to the other participant owners; a fair deal never receives a mechanical benefit or warning.

## 1.4.7 — 25 August 2026

This patch removes the unsupported top-level `system` key from `module.json`, eliminating Foundry VTT v14’s unknown-key warning. PF2E support remains declared through the supported `relationships.systems` entry, including the verified PF2E 8.4.1 compatibility range.

## 1.4.6 — 25 August 2026

This patch repairs the GM table’s behaviour on a 1920×1080 display. The table now opens at a compact 1120 × 820 size, uses smaller GM-only cards and tighter section spacing, caps its height to the viewport, and provides a dedicated vertical scroll area whenever its contents still overflow. The player panel keeps its existing card size and layout.

## 1.4.5 — 25 August 2026

This release adds phase-aware guidance to the GM table and player panel. It explains the current common-card, betting, Pirate Plunder, matching-card surrender, carry-over, or completion step, with wording tailored to the viewer’s role and current turn. Each guide includes a **Poppy's Prize Rules** link that opens `@UUID[JournalEntry.pJeEYJAnY1JQi44e]{Poppy's Prize}`.

## 1.4.4 — 25 August 2026

This patch orders all four setup selectors for faster table preparation. Each list begins with **- Dummy**, then shows active PF2E **Party Members** alphabetically, followed by every other eligible character and NPC actor alphabetically. Party membership comes from the PF2E Party actor rather than an actor name or manual tag.

## 1.4.3 — 25 August 2026

This patch adds a **Poppy’s Prize** anchor button to eligible PF2E character and NPC sheet headers. The GM can open the table from the button. An actor owner can open that actor’s private panel directly from their assigned sheet, while an unassigned actor receives a clear explanatory notice. The control is registered through Foundry and PF2E sheet-header hooks and protected against duplicate insertion.

## 1.4.2 — 25 August 2026

This patch repairs the **Poppy’s Prize Macros** compendium pack. The Macro source now includes the required compendium key, so the compiled LevelDB pack contains **Open Poppy’s Prize** and it appears in the Poppy’s Prize compendium folder. The build test now extracts the completed pack and verifies the Macro’s name, type, command, and icon.

## 1.4.1 — 25 August 2026

This patch corrects deck-count wording and validation. The playable Poppy’s Prize deck has **54 cards**: 52 suited cards and two Pirates. The separately supplied card-back image is artwork for concealed cards and is not part of the playable deck.

## 1.4.0 — 25 August 2026

This release adds **Poppy’s Prize — Your Hand**, a player-facing panel opened from the Token-controls anchor. A participating player with Owner permission on their assigned PC or NPC actor can view their own private hand, the public board, and phase-appropriate controls for common-card selection, betting, Plunder, choosing a matching card to surrender, and carry-over choices.

The GM remains authoritative. Player actions are submitted through the actor they own, then processed only by the active GM after ownership and rules validation. The public board omits every face-down common-card identity, while each private hand and legal-action view is written only to that actor’s owned data. Resetting the table now clears both public and player-view data.

## 1.3.0 — 25 August 2026

This revision replaces the setup dialogue’s multi-select actor list with four **Character** selectors, all defaulting to **- Dummy**. A GM may assign any two to four distinct PF2E PC or NPC actors, leaving the other seats as dummy common-card providers.

The **Automatically transfer PF2E currency** choice now appears directly in the setup dialogue and defaults to off. Its choice is stored with the active game and applies to all later hands at that table; it is no longer a world setting.

## 1.2.0 — 25 August 2026

This release adds a GM-only **Poppy’s Prize** compendium folder containing the **Open Poppy’s Prize** launch macro. The macro has a supplied square nautical anchor-and-card icon, opens the table through the module API, and warns clearly if the module is disabled.

## 1.1.0 — 25 August 2026

This initial GitHub release provides a GM-led Foundry VTT table for the base Poppy’s Prize card game. It automates card dealing, common cards, betting, folding, Pirate Plunder, final betting, poker-hand scoring, split pots, carry-over cards, and dummy seats.

The release supports Foundry VTT 14.367 with PF2E 8.4.1. It accepts both PF2E PC and NPC actors and offers optional automatic currency transfers through PF2E inventory methods. It also bundles 55 visual assets: the 54-card playable deck (52 suit cards and two Pirates) plus a separate card-back image.
