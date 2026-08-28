# PF2e Tavern Games

**PF2e Tavern Games** is a Foundry VTT module for **Foundry VTT v14.367** and **PF2E v8.4.1**. Version 2.1.6 provides a GM-led game library for **Poppy’s Prize**, **Golem**, **Bounder**, **Century**, and a configurable **Drinking Contest**. It supports PC and NPC actors, owner-safe player panels, game-specific cheating, player prompts, and GM disqualification controls.

> **Creator credit:** Created by Tatsu_Gamer using Manus AI.

## Installation

### Recommended: install from the manifest URL

Install PF2e Tavern Games directly from Foundry’s **Add-on Modules** setup screen:

1. From Foundry’s main **Game Worlds** setup screen, select **Add-on Modules** in the left navigation.
2. Select **Install Module**.
3. Paste the following URL into the **Manifest URL** field:

   ```text
   https://github.com/tatsumasagc/pf2e-tavern-games/releases/latest/download/module.json
   ```

4. Select **Install** and wait for Foundry to download the module.
5. Launch the target PF2E world. Open **Manage Modules**, enable **PF2e Tavern Games**, and save the module configuration.
6. Reload the world once. A GM should load the world first when updating from the retired `poppys-prize` package so the one-time table-state and actor-view migration can complete.

> **Private repository note.** Foundry’s installer can fetch the manifest URL only when the release is publicly reachable by the Foundry server. While this GitHub repository remains private, use the manual ZIP installation below or make the repository/release public before using the manifest option.

### Manual ZIP installation

Download the latest `pf2e-tavern-games-v2.1.6.zip` release asset and extract it into Foundry’s `Data/modules/` directory. The manifest must be located at:

```text
Data/modules/pf2e-tavern-games/module.json
```

Enable **PF2e Tavern Games** in the target PF2E world. Version 2.1.6 uses the `pf2e-tavern-games` package ID. Disable the retired `poppys-prize` package after the new package has loaded successfully.

## Open the game library

A GM can open the library from the dice control in the Token Controls, from the **PF2e Tavern Games** button on a character or NPC sheet, or with the bundled **Open PF2e Tavern Games** macro. The library lets the GM start a new table for each supported game. Players who have **Owner** permission on a participating actor can use the same actor-sheet button to open their private player panel.

| Game | Participants | Core procedure |
|---|---:|---|
| **Poppy’s Prize** | 2–4 | A 54-card poker game with common cards, betting, Pirates, Plunder, carry-over cards, and a Poppy/Dealer. |
| **Golem** | 3–6 | Five-card poker against a best-five-card golem hand formed from the discard pile; the winner must beat the golem to claim the pot. |
| **Bounder** | 2+ | A Shooter’s two d20 results attempt to bracket the Dealer’s 3d6 total; players may make point or side bets. |
| **Century** | 2+ | Players select 2–10 numbers from 1–100; the Dealer draws twenty unique two-d10 results and applies the official payout table. |
| **Drinking Contest** | 2+ | Every contestant presses Ready each round; blind Performance and Fortitude rolls drive a six-stage condition track. |

## Golem card art

Golem now uses the supplied **53-image material deck** in the GM card table and each participant’s private hand: 52 numbered face cards across **Flesh, Clay, Stone, and Iron** (ranks 1–13), plus `golem_card_back.png`. The module uses that supplied PNG unchanged wherever a Golem card must remain concealed, including the deck owner’s marked-card sight. No retired standard-suit or joker artwork is included in Golem’s playable deck.

## GM oversight and player panels

The GM creates and controls every table. For Golem, Bounder, Century, and the Drinking Contest, the GM first chooses the number of participants, then selects every participant from an individual dropdown. Each selector begins with **- Dummy**, followed by Party Members and then other eligible actors in alphabetical order; after a count is chosen, every selector must name a different actor. The player panel reveals only a participant’s own hand or legal choices. The GM may use **Open player panel** to prompt an actor’s active Owner to open it remotely. The player interface has an independent scroll area and highlights the current turn. Every tavern-game table provides **Disqualify** beside each active participant; a disqualified actor cannot submit further actions.

## Cheating

The module checks item slugs, never names, for cheating equipment. It offers marked-card sight or loaded-dice result selection only when the actor currently serving in the required role has the matching item in their inventory. A cheating-related concealment check is blind to the GM and cheating information stays within authorised actor-owned views or specified whispers.

| Game | Eligibility and result |
|---|---|
| **Poppy’s Prize** | Any Poppy may cheat by choosing every card needed to complete their hand and making a blind Performance or Deception Create a Diversion check, compared separately with each observer’s Perception DC. Only a deck owner with `marked-playing-cards` receives the additional marked-card benefits: two selected opening cards on game one or later-game marked-card sight. |
| **Golem** | Any Dealer may cheat by choosing every card needed to complete their hand and making a blind Performance or Deception Create a Diversion check, using the same observer-by-observer detection model. Only a Dealer/deck owner with `marked-playing-cards` receives the additional marked-card benefits: two selected opening cards on the first hand or marked-card sight. |
| **Bounder** | Only the Shooter with `games-loaded-dice` in their inventory may choose the result of either d20 roll. |
| **Century** | Only the Dealer with `games-loaded-dice` in their inventory may choose the twenty results. |
| **Drinking Contest** | Any contestant may choose to cheat when pressing Ready. Their Fortitude save automatically succeeds; they choose a blind Performance or Deception Create a Diversion check, compared separately with each other contestant’s Perception DC. The GM and observers who detect the cheat receive targeted private notices. |

## Dealer social cheating

In the prepared **Deal** phase of Poppy’s Prize or Golem, the active Poppy or Dealer may select **Cheat and choose my hand**. They choose every card required to complete their own hand, then select either **Performance** or **Deception — Create a Diversion**. The module records the chosen cards only in the GM-authoritative game state, makes the chosen skill roll blind to the GM, and compares that roll independently with each qualified observer’s Perception DC.

A failure or critical failure against an observer whispers a suspicion message to that observer’s active Owners and a separate audit message to the GM. No message is issued when the cheating Dealer succeeds or critically succeeds against an observer. This social-cheating route gives no information about other hands. An actor must still have `marked-playing-cards` to use marked-card sight or the special two-card first-hand marked selection.

## Drinking Contest stages

The GM sets the Fortitude DC when starting a contest. Once all qualified contestants are Ready, the module submits each Performance and Fortitude check together as blind-to-GM rolls. A critical success decreases stage by 1; success leaves it unchanged; failure increases it by 1; and critical failure increases it by 2. The module applies the stated PF2E conditions and a timed effect for the fear-save bonus. Stage 6 eliminates the contestant.

| Stage | Name | Automated effect |
|---:|---|---|
| 0 | Clear-Headed | No contest effect. |
| 1 | Liquid Courage | +1 item bonus to saving throws against fear effects for 10 minutes. |
| 2 | Tipsy | Off-guard and the Stage 1 bonus for 10 minutes. |
| 3 | Sloshed | Clumsy 1, off-guard, and stupefied 2 for 10 minutes. |
| 4 | Wobbling | Clumsy 2 and sickened 2 for 10 minutes. |
| 5 | Blackout Bound | Clumsy 2, sickened 2, and stupefied 2 for 10 minutes. |
| 6 | Passed Out | Unconscious for 8 hours and eliminated from the contest. |

Starting another contest or closing a drinking table removes only the conditions and effects that this module created or changed. It does not remove unrelated actor conditions.

## Compendiums

The **PF2e Tavern Games** compendium folder includes the **PF2e Tavern Games Macros** pack and a player-readable **PF2e Tavern Games Journals** pack. The pack contains six distinct entries: a rules reference for Poppy’s Prize, Golem, Bounder, Century, and the Drinking Contest, plus a module-use guide. Each carries creator and source acknowledgement where applicable.

## Sources and content boundary

Poppy’s Prize originates in *Jewel of the Indigo Isles*. Golem, Bounder, and Century originate in *Pathfinder #159: All or Nothing*, p. 76, as presented by [Archives of Nethys][1]. The Drinking Contest is a table rule supplied for this module. This repository provides automation and reference material; it does not reproduce published adventure text or assets beyond the user-supplied Poppy’s Prize and Golem card art.

[1]: https://2e.aonprd.com/Rules.aspx?ID=1452

## Development

The deterministic game engines are in `scripts/engine.mjs` and `scripts/tavern-games-engine.mjs`. Run the compendium build and validation suite with:

```bash
pnpm run build:pack
pnpm run test
```

The suite checks Poppy’s Prize, all four added game engines, staged dealing, cheating eligibility, drinking stages, manifest metadata, and both compiled compendium packs.

## License

See [LICENSE](LICENSE).
