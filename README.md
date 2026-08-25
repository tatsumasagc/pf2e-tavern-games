# Poppy’s Prize

**Poppy’s Prize** is a GM-led Foundry VTT module for the piratical poker game described in *Jewel of the Indigo Isles*. It creates a shared card table, runs the four common-card and betting rounds, handles the two-Pirate Plunder phase, evaluates the best five-card poker hands, splits the pot when appropriate, and preserves the game’s between-round card-keeping procedure. Version 1.4.5 uses the supplied **54-card playable deck**—52 suited cards plus two Pirates—and a separate card-back image for concealed cards. It permits both PF2E PC and NPC actors as players, includes a launch macro in its own compendium folder, provides four explicit setup seats that can be left as dummies, and adds a privacy-safe player panel.

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

The GM should create or import every actor who will join the game before opening the table. The setup dialogue provides **four Character selectors**, each defaulting to **- Dummy**. Each selector presents **- Dummy** first, then current **Party Members** in alphabetical order, followed by all other eligible PF2E PC and NPC actors in alphabetical order. Choose any two to four distinct actors; every seat left as a dummy supplies only the missing face-down common card. For a player to use the interactive panel, their Foundry User must have **Owner** permission on their assigned actor; setting that actor as the User’s default character is recommended.

Every eligible PF2E character and NPC sheet now has a **Poppy’s Prize** anchor button in its header. A GM can use it to open the table. An actor owner can use it to open that actor’s private hand when the actor is assigned to an active game. The control remains visible to an actor owner before a game begins, but it explains when that actor has not yet been selected for the table.

## Macro compendium

The Compendium Packs sidebar contains a **Poppy’s Prize** folder with a GM-only **Poppy’s Prize Macros** pack. The pack now contains a compiled **Open Poppy’s Prize** script Macro, which launches the table and shows a clear warning if the module has not been enabled. The macro uses the included square nautical card-and-anchor icon. To use it frequently, open the pack as a GM and drag the macro to the Foundry macro bar.

| Module setting | Default | Effect |
|---|---:|---|
| **Table state** | Hidden and GM-restricted | Stores the authoritative active game, including every private hand. |
| **Public board** | Visible | Stores only public information: revealed common cards, contributions, pot, phase, and turn. |
| **Player view** | Actor-owner only | Stores an individual participant’s hand and legal choices on that participant’s actor. |

## Table workflow

The GM retains the authoritative table and can record every choice directly, which remains useful for an in-person or hybrid session. Players can select the **Poppy’s Prize** anchor in their assigned PC or NPC sheet header, or the anchor in the Token controls, to open **Poppy’s Prize — Your Hand**. Their panel shows only their actor-owned hand, the public board, and controls that are legal at the current phase.

Both panels include a phase guide that explains the current step, identifies whether a player is acting or waiting, and links to the world’s **Poppy’s Prize Rules** journal entry (`@UUID[JournalEntry.pJeEYJAnY1JQi44e]{Poppy's Prize}`). The GM guide focuses on the action to record; the player guide focuses on that participant’s available choice.

A player action is written as an actor-owned request and is processed only by the active GM. The GM validates both that the requester owns the participating actor and that the requested move is legal under the rules engine before changing the game state or transferring currency. The public board deliberately masks every face-down common card, and another participant’s hand is never written to a player-visible document.

| Stage | Module behaviour |
|---|---|
| **Deal and ante** | Deals five cards to each real player, sets one Pirate aside for the first game, records all antes, and creates dummy common cards if needed. The table renders the supplied suit, rank, Pirate, and card-back artwork. |
| **Common cards** | Each player can choose a private hand card from their own panel; the module reveals common cards clockwise from Poppy and opens a betting round after each reveal. |
| **Betting** | The player whose turn it is can pass, call, raise, or fold from their panel. The GM validates the move, computes the amount due, and applies optional currency transfers. |
| **Plunder** | A Pirate holder can choose a target and demand from their panel. A Plundered player selects one highlighted matching card from their own hand. Pirate holders are protected from Plunder. |
| **Final betting and showdown** | Runs the last betting phase after Plunder, evaluates the strongest five-card poker hand from each active player’s hand plus the common pool, awards or splits the pot, and carries any indivisible copper remainder forward. |
| **Carry-over** | Every player can choose their own carry-over card or keep nothing. A round winner can also choose from the common pool. The next game tops each player back up to five cards. |

## Currency safety

Automatic transfers are intentionally **opt-in**. The **Start Poppy’s Prize** dialogue contains an **Automatically transfer PF2E currency** checkbox, which is clear by default. The selected choice applies to that table and its later hands. With the checkbox clear, the table still tracks every contribution and payout but does not alter actor wealth. This is recommended when you use party funds, custom denominations, treasure awards, or handwaved tavern stakes.

With automatic transfers enabled, the module checks that every participating PC or NPC actor can afford an ante before a new game starts. Individual calls and raises are checked before they are committed. If a payment cannot be completed, the game state is not advanced. Payouts use the PF2E system’s inventory currency API, which permits value-based conversion between denominations when a player pays a precise copper amount.

The **Reset table** control clears the stored table, public board, and actor-owned player views. It never refunds or otherwise changes character currency. This avoids an accidental second transfer after a manual correction.

## Included card artwork

The module’s playable deck contains **54 cards**: the four suit families from Ace through King (52 cards) plus two distinct Pirates. The supplied `card_back.webp` file is **not** a playable card; it is artwork used whenever a private hand or common card is face-down. The logical Ace maps to the supplied `01` artwork. Card faces and the card back are displayed directly from the module files, so no separate Foundry Cards deck setup is required.

## Known boundaries

This release implements the base Poppy’s Prize game. It does not presently automate the **Gourmet Course**, **Lone Captain**, or **Dragon and the Rum** variants.

The result of a split-pot game is supported. If the source rules leave the next dealer unspecified after a split pot, the module uses the first tied winner in seating order. The Pirate award tiebreak uses the higher showdown hand, then clockwise order from Poppy’s left, matching the described hierarchy.

## References

[1]: https://foundryvtt.com/packages/pf2e "Pathfinder Second Edition package listing"
[2]: https://foundryvtt.com/article/module-development/ "Foundry VTT: Introduction to Module Development"
