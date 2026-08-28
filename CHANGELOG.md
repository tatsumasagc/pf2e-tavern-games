# Changelog

All notable changes to **PF2e Tavern Games**, including its Poppy’s Prize game, are documented in this file.

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
