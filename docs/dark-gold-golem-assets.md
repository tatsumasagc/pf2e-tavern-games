# Dark-Gold Golem Deck Asset Mapping

The supplied `dark-gold.zip` contains **54 WebP assets**: 52 standard playing-card faces, one `back.webp`, and one `joker.webp`.

The Golem playable deck uses the 52 standard suited faces only. Faces are named `{suit}-{rank}.webp`, where suit is `clubs`, `diamonds`, `hearts`, or `spades`, and rank is `02` through `10`, `ace`, `jack`, `queen`, or `king`.

The dark-gold face artwork is a 1024×1536 portrait card with a dark slate field, an antique-gold border, suit/rank pips, and a central d20/anvil motif. `back.webp` is the matching 1024×1536 dark-gold card back and must be rendered for every concealed Golem card. `joker.webp` is excluded from Golem’s deck and card mapping.

The module will store these assets in `assets/golem-cards/` and resolve them under the stable Foundry URL prefix `modules/pf2e-tavern-games/assets/golem-cards/`.
