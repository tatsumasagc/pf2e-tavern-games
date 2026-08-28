# Golem Deck Asset Mapping

The supplied `golem_deck_complete.zip` contains **53 PNG assets**: 52 numbered face cards and one reversible `golem_card_back.png` image.

| Asset group | Files | Module use |
| --- | --- | --- |
| Flesh | `flesh_01.png` through `flesh_13.png` | Playable Golem face cards |
| Clay | `clay_01.png` through `clay_13.png` | Playable Golem face cards |
| Stone | `stone_01.png` through `stone_13.png` | Playable Golem face cards |
| Iron | `iron_01.png` through `iron_13.png` | Playable Golem face cards |
| Card back | `golem_card_back.png` | All concealed Golem cards, including marked-card sight |

The Golem playable deck contains only the 52 numbered material-suit faces. The engine maps its four logical suits to **Flesh**, **Clay**, **Stone**, and **Iron**, preserving its poker evaluator by treating the displayed rank 1 as high for scoring. The source cards are 1536 × 2304 pixels in a 2:3 portrait ratio and are bundled unchanged under `assets/golem-cards/`.

Foundry resolves the files using the stable module prefix `modules/pf2e-tavern-games/assets/golem-cards/`.
