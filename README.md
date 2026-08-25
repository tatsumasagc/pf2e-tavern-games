# Poppy’s Prize

**Poppy’s Prize** is a GM-led Foundry VTT module for the piratical poker game described in *Jewel of the Indigo Isles*. It creates a shared card table, runs the four common-card and betting rounds, handles the two-Pirate Plunder phase, evaluates the best five-card poker hands, splits the pot when appropriate, and preserves the game’s between-round card-keeping procedure. Version 1.1.0 embeds the supplied 55-card visual deck and permits both PF2E PC and NPC actors as players.

The module targets **Foundry VTT 14.367** and **PF2E 8.4.1**. PF2E 8.4.1 is verified for Foundry 14.367 by the system’s package listing.[1] The module uses Foundry’s declared module manifest, ES module, settings, and standard document APIs rather than overriding core interface methods.[2]

> **Content note.** This module automates a game procedure. It does **not** include text, illustrations, maps, cards, or other reproduced adventure content from *Jewel of the Indigo Isles*.

## Installation

Extract `poppys-prize.zip` into your Foundry user-data directory under `Data/modules/`. The final path must be:

```text
Data/modules/poppys-prize/module.json
```

Restart Foundry, open **Manage Modules** for a PF2E world, and enable **Poppy’s Prize**. A GM can then select the anchor button from the Token controls, or run this macro:

```js
game.modules.get("poppys-prize")?.api.open();
```

The GM should create or import every actor who will join the game before opening the table. The setup dialogue accepts **two to four PF2E PC or NPC actors**. Where fewer than four players take part, the module adds dummy seats solely to provide the missing face-down common cards.

| Module setting | Default | Effect |
|---|---:|---|
| **Automatically transfer PF2E currency** | Off | When enabled, the module deducts antes and betting commitments from the linked PC or NPC actors, and adds payouts to them using PF2E’s inventory currency methods. |
| **Table state** | Hidden and GM-restricted | Stores the active game, including private hands, in a GM-restricted world setting. |

## Table workflow

The GM records choices from the table interface. This deliberate GM-led workflow means that player hands remain private and that the table still works for an in-person or hybrid session without requiring a separate player-side application. The game state and table controls are GM-restricted, so players cannot inspect another player’s face-down hand through Foundry data.

| Stage | Module behaviour |
|---|---|
| **Deal and ante** | Deals five cards to each real player, sets one Pirate aside for the first game, records all antes, and creates dummy common cards if needed. The table renders the supplied suit, rank, Pirate, and card-back artwork. |
| **Common cards** | Lets each player choose a private hand card; the module reveals common cards clockwise from Poppy and opens a betting round after each reveal. |
| **Betting** | Enforces pass, call, raise, and fold availability, computes the amount still due, tracks each player’s contribution, and ends the betting round only when every active player has acted without a further raise. |
| **Plunder** | Prompts each Pirate holder in dealer-to-clockwise order. A Pirate may request a suit, a value, or both; the target chooses among matching cards; the spent Pirate is removed from the game. Pirate holders are protected from Plunder. |
| **Final betting and showdown** | Runs the last betting phase after Plunder, evaluates the strongest five-card poker hand from each active player’s hand plus the common pool, awards or splits the pot, and carries any indivisible copper remainder forward. |
| **Carry-over** | Awards the set-aside Pirate after the first game to the highest common card, then lets every player keep one private card while allowing the round winner to keep a common card. The next game tops each player back up to five cards. |

## Currency safety

Automatic transfers are intentionally **opt-in**. With the setting disabled, the table still tracks every contribution and payout but does not alter actor wealth. This is recommended when you use party funds, custom denominations, treasure awards, or handwaved tavern stakes.

With automatic transfers enabled, the module checks that every participating PC or NPC actor can afford an ante before a new game starts. Individual calls and raises are checked before they are committed. If a payment cannot be completed, the game state is not advanced. Payouts use the PF2E system’s inventory currency API, which permits value-based conversion between denominations when a player pays a precise copper amount.

The **Reset table** control clears only the stored card-table state. It never refunds or otherwise changes character currency. This avoids an accidental second transfer after a manual correction.

## Included card artwork

The package contains web-optimised copies of the deck supplied with this module update: the four suit families, Ace through King, both Pirates, and the card back. The logical Ace maps to the supplied `01` artwork, and the two Pirate cards are retained as distinct cards. Face-down common cards use the supplied card back; card faces are displayed directly from the module files, so no separate Foundry Cards deck setup is required.

## Known boundaries

This first release implements the base Poppy’s Prize game. It does not presently automate the **Gourmet Course**, **Lone Captain**, or **Dragon and the Rum** variants. The table also does not try to adjudicate a player falsely claiming not to hold a matching card; the GM can simply select the matching card that is surrendered.

The result of a split-pot game is supported. If the source rules leave the next dealer unspecified after a split pot, the module uses the first tied winner in seating order. The Pirate award tiebreak uses the higher showdown hand, then clockwise order from Poppy’s left, matching the described hierarchy.

## References

[1]: https://foundryvtt.com/packages/pf2e "Pathfinder Second Edition package listing"
[2]: https://foundryvtt.com/article/module-development/ "Foundry VTT: Introduction to Module Development"
