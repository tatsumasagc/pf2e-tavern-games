# PF2e Tavern Games

**PF2e Tavern Games** is a Foundry VTT module for **Foundry VTT v14.367** and **PF2E v8.4.1**. Version 2.1.1 provides a GM-led game library for **Poppy’s Prize**, **Golem**, **Bounder**, **Century**, and a configurable **Drinking Contest**. It supports PC and NPC actors, owner-safe player panels, game-specific cheating, player prompts, and GM disqualification controls.

> **Creator credit:** Created by Tatsu_Gamer using Manus AI.

## Installation

Download `pf2e-tavern-games-v2.1.1.zip` from the latest release and extract it into Foundry’s `Data/modules/` directory. The manifest must be located at:

```text
Data/modules/pf2e-tavern-games/module.json
```

Enable **PF2e Tavern Games** in the target PF2E world. Version 2.1.1 uses the `pf2e-tavern-games` package ID. It retains a one-time GM migration for table state and actor-owned player views created under the retired `poppys-prize` package ID. Disable the retired module after the new package has loaded successfully.

## Open the game library

A GM can open the library from the dice control in the Token Controls, from the **PF2e Tavern Games** button on a character or NPC sheet, or with the bundled **Open PF2e Tavern Games** macro. The library lets the GM start a new table for each supported game. Players who have **Owner** permission on a participating actor can use the same actor-sheet button to open their private player panel.

| Game | Participants | Core procedure |
|---|---:|---|
| **Poppy’s Prize** | 2–4 | A 54-card poker game with common cards, betting, Pirates, Plunder, carry-over cards, and a Poppy/Dealer. |
| **Golem** | 3–6 | Five-card poker against a best-five-card golem hand formed from the discard pile; the winner must beat the golem to claim the pot. |
| **Bounder** | 2+ | A Shooter’s two d20 results attempt to bracket the Dealer’s 3d6 total; players may make point or side bets. |
| **Century** | 2+ | Players select 2–10 numbers from 1–100; the Dealer draws twenty unique two-d10 results and applies the official payout table. |
| **Drinking Contest** | 2+ | Every contestant presses Ready each round; blind Performance and Fortitude rolls drive a six-stage condition track. |

## GM oversight and player panels

The GM creates and controls every table. For Golem, Bounder, Century, and the Drinking Contest, the GM first chooses the number of participants, then selects every participant from an individual dropdown. Each selector begins with **- Dummy**, followed by Party Members and then other eligible actors in alphabetical order; after a count is chosen, every selector must name a different actor. The player panel reveals only a participant’s own hand or legal choices. The GM may use **Open player panel** to prompt an actor’s active Owner to open it remotely. The player interface has an independent scroll area and highlights the current turn. Every tavern-game table provides **Disqualify** beside each active participant; a disqualified actor cannot submit further actions.

## Cheating

The module checks item slugs, never names, for cheating equipment. It offers marked-card sight or loaded-dice result selection only when the actor currently serving in the required role has the matching item in their inventory. A cheating-related concealment check is blind to the GM and cheating information stays within authorised actor-owned views or specified whispers.

| Game | Eligibility and result |
|---|---|
| **Poppy’s Prize** | Only the current deck owner with `marked-playing-cards` can select two opening cards on game one or elect later-game marked-card sight. Whenever cheating, they choose a blind Performance or Deception Create a Diversion check, compared separately with each observer’s Perception DC. |
| **Golem** | Only the Dealer/deck owner with `marked-playing-cards` can select two opening cards on the first hand or use marked-card sight. They choose a blind Performance or Deception Create a Diversion check, using the same observer-by-observer detection model as Poppy’s Prize. |
| **Bounder** | Only the Shooter with `games-loaded-dice` in their inventory may choose the result of either d20 roll. |
| **Century** | Only the Dealer with `games-loaded-dice` in their inventory may choose the twenty results. |
| **Drinking Contest** | Any contestant may choose to cheat when pressing Ready. Their Fortitude save automatically succeeds; they choose a blind Performance or Deception Create a Diversion check, compared separately with each other contestant’s Perception DC. The GM and observers who detect the cheat receive targeted private notices. |

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

Poppy’s Prize originates in *Jewel of the Indigo Isles*. Golem, Bounder, and Century originate in *Pathfinder #159: All or Nothing*, p. 76, as presented by [Archives of Nethys][1]. The Drinking Contest is a table rule supplied for this module. This repository provides automation and reference material; it does not reproduce published adventure text or assets beyond the user-supplied Poppy’s Prize card art.

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
