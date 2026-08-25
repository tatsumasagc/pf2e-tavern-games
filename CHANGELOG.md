# Changelog

All notable changes to **Poppy’s Prize** are documented in this file.

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
