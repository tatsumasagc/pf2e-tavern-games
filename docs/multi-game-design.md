# PF2e Tavern Games Multi-Game Design

## State and permissions

The existing Poppy’s Prize state remains intact under its current game state setting. New games use a separate authoritative, GM-restricted `tavernGameState` world setting, plus a public view setting and actor-owned private view/request flags. Only the active GM resolves requests, rolls dice, transfers any optional currency, changes drinking stages, and disqualifies a participant. Player panels receive only their own legal controls and public information.

## Game selection

The existing GM launcher opens a game library. Poppy’s Prize retains its dedicated setup and table. Golem, Bounder, Century, and the drinking contest use a shared setup panel with game-specific fields. A game can include eligible PF2E character and NPC actors; all players require Owner permission on their actor for self-service controls. The GM can always record an action directly.

## Golem

Golem supports three to six participants and one dealer. It uses the supplied card assets as a 52-card deck (the two Pirates are excluded), five-card draw poker ranking, an amulet seat, two betting rounds, up-to-two-card discards, and a golem hand made from all discards. If the winning player does not beat the golem hand, the engine carries the pot forward, charges that player twice the ante, rotates the amulet counterclockwise, and starts the next hand for the remaining players. A sole remaining player wins less a 5% house share. A dealer holding `marked-playing-cards` may elect the existing marked-card workflow: private marked-card sight and a blind Palm an Object check with per-observer Perception comparison.

## Bounder

Bounder tracks a current shooter, shooter stake, optional doubled stake, point bets, dealer side bets, two d20 rolls, and the dealer’s 3d6 roll. It resolves point equality, bounds, the special 1-and-20 shooter double payout, all-even/all-odd dealer bet payout, and triples dealer bet payout. A shooter with `games-loaded-dice` can select the numerical result of each of their own d20 rolls; the dealer’s dice cannot be selected by the shooter. The next qualified participant clockwise becomes shooter.

## Century

Century tracks individual 2–10-number selections and stakes. It generates 20 distinct 1–100 results and applies the published multiplier table to each player’s stake. The dealer can choose all twenty generated numbers only when their actor has `games-loaded-dice`; standard validation requires 20 unique integers in the 1–100 range. Loaded dealer numbers are hidden until normal results reveal.

## Drinking contest

Each player begins at Stage 0. For every round players select Ready, and when all qualified players are ready, the active GM makes every Performance check and Fortitude save as a blind-to-GM PF2E roll. Fortitude degree of success against the GM’s DC adjusts stage: critical success -1, success 0, failure +1, critical failure +2. Stage 6 is elimination. A player can elect to cheat: their Fortitude outcome counts as a success, while their blind Performance total is compared with every other qualified participant’s Perception DC. Detection whispers go only to the GM and the owner(s) of each successful observer.

The module creates and owns a single temporary PF2E effect for each participant’s current drinking stage. Before applying a new stage it deletes the previous module-owned effect and stage-owned conditions. Standard PF2E condition items are added only under that effect’s own module flag, so unrelated conditions are not removed. Stage 1 is *Liquid Courage* (+1 item bonus to saves against fear for 10 minutes); Stage 2 is *Tipsy* (off-guard and the same bonus for 10 minutes); Stage 3 is *Sloshed* (clumsy 1, off-guard, stupefied 2 for 10 minutes); Stage 4 is *Wobbling* (clumsy 2 and sickened 2 for 10 minutes); Stage 5 is *Blackout Bound* (clumsy 2, sickened 2, and stupefied 2 for 10 minutes); Stage 6 is *Passed Out* (unconscious for 8 hours).

## Disqualification

Every table includes a GM-only Disqualify control. It records the actor, reason, and timestamp in the authoritative state, prevents future requests from that actor, and makes the player ineligible for outcomes. In Poppy’s Prize it additionally folds the participant and drops their future turn. In gambling games their open bets remain in the pot. In drinking contests the actor is removed from round readiness and has module-owned drinking effects cleared. All disqualifications are announced to the table without private card/die information.

## Sources

Poppy’s Prize is from *Jewel of the Indigo Isles*. Golem, Bounder, and Century are from *Pathfinder #159: All or Nothing*, p. 76, as presented by Archives of Nethys. The drinking contest and its stages follow the user-specified procedure for this module.
