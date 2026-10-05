# CRAPSHOOT: Game Design

A dice roguelite. Build a cup of crooked dice, chase Full Houses and Five of a Kinds, level up your favorite hands, and stack charms until the house breaks.

## Pillars

1. **Learn in one throw.** Throw, hold what you like, reroll the rest, score. Everyone already knows how this works.
2. **Every throw is a moment.** Each throw resolves into a named hand ("FULL HOUSE", "FIVE OF A KIND") that cascades through dice and charms, Balatro style.
3. **One scarce resource.** Rerolls are a single pool for the whole table. Spend them chasing a big hand now, or save them for later throws.
4. **The dice are the deck.** Custom faces, mods, twins and a bigger cup change what you can roll. Skill is building a cup that makes the hands your charms want.

## Glossary

| Term | Meaning |
|---|---|
| Run | 8 Antes. Beat the Ante 8 Pit Boss to win. Endless after that. |
| Ante | 3 Tables: Low Roller, High Roller, Pit Boss. |
| Table | A round. Reach the Target score before your Throws run out. |
| Box | Your dice collection (max 8). |
| Cup | The dice you throw (5 slots). Everything in the Cup is thrown every Throw. The rest sit on the Bench. |
| Throw | Roll the whole Cup, reroll as you like, then score one hand. 4 per table. |
| Reroll | Rerolls every die you aren't holding. 5 per table, shared across all Throws. |
| Hand | What the dice make: Pair up to Six of a Kind. Levels up via Cocktails. |
| Charm | Held passive (5 slots). Balatro jokers. |
| Comp | Consumable (2 slots): Cocktails level hands, Tokens modify dice, Tricks bend a Throw. |

## The Table Loop

Each table has a **Target**, **Throws** (base 4), **Rerolls** (base 5, shared), your **Cup** and a **Score**.

1. **Throw.** Every die in the Cup lands on one of its faces. Twin dice split: a temporary copy joins the throw.
2. **Hold and reroll.** Tap dice to hold them. Reroll throws the rest and spends 1 Reroll from the table's pool. Repeat while Rerolls last.
3. **Score.** The game lists every hand the dice make with a preview, best first. Score it (or pick another). The Throw is spent.
4. If Score >= Target, the table is won immediately. Unused Throws pay $1 each.
5. Out of Throws below the Target: game over.

## Scoring

`score = (hand chips + pips of the scoring dice + bonuses) x (hand mult + bonuses) x (x-mult bonuses)`

Only the dice that make the hand score (a Pair scores 2 dice). The others are **idle**: some mods and charms care about idle dice. Order of resolution:

1. Hand base Chips and Mult (by level).
2. Each scoring die, left to right: its pips as Chips, then its mods, then charms that react to that die. Echo and retrigger charms repeat this step.
3. Each idle die: Steel, then charms that react to idle dice.
4. Charms, left to right.
5. Boss rules (voided hands score 0).

Wild faces become whatever value makes each hand best. Mirror dice show the most common face among your other dice.

### Hands

| Hand | Needs | Chips x Mult | Per level |
|---|---|---|---|
| High Die | 1 die | 5 x 1 | +10 / +1 |
| Pair | 2 matching | 10 x 2 | +15 / +1 |
| Two Pair | 2 + 2 | 20 x 2 | +20 / +1 |
| Three of a Kind | 3 matching | 25 x 3 | +20 / +2 |
| Small Straight | 4 in a row | 30 x 3 | +20 / +2 |
| Full House | 3 + 2 | 35 x 4 | +25 / +2 |
| Large Straight | 5 in a row | 40 x 4 | +30 / +2 |
| Four of a Kind | 4 matching | 45 x 5 | +30 / +3 |
| Five of a Kind | 5 matching | 80 x 8 | +35 / +3 |
| Three Pair | 6 dice: 2 + 2 + 2 | 40 x 4 | +25 / +2 |
| Two Triples | 6 dice: 3 + 3 | 60 x 6 | +30 / +3 |
| Grand Straight | 6 dice: 1-2-3-4-5-6 | 70 x 7 | +35 / +3 |
| Six of a Kind | 6 matching | 120 x 12 | +40 / +4 |

The six-dice hands are secret until you can throw six dice (Big Cup, Sixth Sense, a Twin). Their cocktails only show up in the shop once you can.

Base values are compressed compared to Balatro because dice make sets far more easily than a deck does. With 5 rerolls a smart player scores Three of a Kind or better on most throws.

## Dice

Every die has 6 faces (a **face set**) and up to 3 **mods**.

**Face sets**: Standard (1-6), Loaded (2,3,4,5,6,6), Lowball (1,1,2,2,3,3), Highball (4,4,5,5,6,6), Odd (1,1,3,3,5,5), Even (2,2,4,4,6,6), Two-Face (1,1,1,6,6,6), Midway (2,3,3,4,4,5), Wild (W,2,3,4,5,6). Sets narrow the faces so matches come easier, at the cost of straights.

**Mods**:

| Mod | Effect |
|---|---|
| Gold | +$1 when it scores |
| Glass | x2 Mult when it scores, 1 in 6 to shatter |
| Steel | x1.5 Mult when thrown but idle |
| Hot | Gains +4 Chips for good every time it scores |
| Lucky | When it scores: 1 in 4 for +12 Mult, 1 in 12 for +$5 |
| Ruby | +Mult equal to its face |
| Heavy | Pips count x5 |
| Echo | Scores twice |
| Mirror | Shows the most common face among your other dice |
| Twin | Splits in two when thrown: a copy joins every throw |
| Spinner | +1 Reroll when it scores |

**Fusion** ($3, Dice Box): merge two dice. Keep one die's faces, combine mods (max 3).

### More dice, fewer dice

- **Big Cup** (upgrade) and **Sixth Sense** (charm) add a Cup slot. Six dice unlock the secret hands.
- **Twin** dice split every throw. **Double Down** (trick) copies a thrown die for one throw. **Split Decision** (charm) turns a lone Pair into Three of a Kind by adding a die.
- **Photocopy** (token) and **Mitosis** (charm) clone dice into your Box for good. **Clone Army** grows with every duplicate.
- Going light is a build too: **Light Pockets** gives x2 Mult per empty Cup slot, and **The Minimalist** starts with four dice.
- Bosses push back: **The Pinch** throws one fewer die.

## Charms

50 charms, 5 slots, sold for half price. Families:

- **Flat**: Lucky Penny (+4 Mult), Poker Chip (+50 Chips).
- **Hand-conditional**: "+Mult if the hand contains a Pair / Two Pair / Three of a Kind / a Straight" (Pair-a-Dice, Double Date, Three Ring, Ladder), chip versions (Pair of Socks, Triple Decker, Straight Shooter), and x-mult versions (The Trio, Open House, The Order, The Family, Jackpot).
- **Per-die**: Six Shooter, Snake Eyes, Even Steven, Odd Todd, Low Rider, Tooth Fairy. Retriggers: Photo Finish, Encore.
- **Reroll economy**: Steady Hand (+2 Rerolls), Tinkerer (Mult per reroll this throw), Beginner's Luck (x2 if no reroll), Patience ($ per unused reroll), All In (+2 Throws, no Rerolls), Green Thumb (grows per throw, shrinks per reroll).
- **Dice count**: Sixth Sense, Split Decision, Mitosis, Clone Army, Light Pockets, Crowd Pleaser, Idle Hands, Sideline, Team Player, Hoarder.
- **Rules benders**: Shortcut (straights may skip a number), Four Fingers (straights need one fewer die), Wild Card (every 1 is Wild), Stargazer (1 in 4 to level the hand).
- **Scalers**: Runner, Ice Cream, Popcorn, Lucky Cat, Glassblower, Barfly, Hot Streak, The Regular.
- **Economy**: Piggy Bank, Fat Wallet, Comped, Mixologist.
- **Tradeoff**: High Stakes (x2.5 Mult, one fewer Throw).

## Comps (consumables, 2 slots)

- **Cocktails** ($3): level up one hand. 13 cocktails, one per hand.
- **Tokens** ($3): permanently change a die. Add a mod (11 tokens), Chisel (lowest face becomes 6), Sandpaper (highest face becomes 1), Wildcard (lowest face becomes Wild), Photocopy (duplicate a die), Solvent (strip mods for $4 each).
- **Tricks** ($3-5): used at the table, mid-throw. Nudge Up, Nudge Down, Flip (to the opposite side), Double Down (copy a thrown die), Second Wind (+2 Rerolls), Overtime (+1 Throw).

## Pit Bosses

The third table of each ante has a rule and a target x2:

The Pinch (1 fewer die), The Cooler (2 fewer Rerolls), Eye in the Sky (each hand scores once), The Shaver (half base values), The Short Stack (1 fewer Throw), The Wall (target doubled), The Taxman (Rerolls cost $1), The Scorpion (1s and 2s don't score), The Ceiling (6s don't score), House Dice (all dice roll plain 1-6), The Iron Hand (only your first hand type counts, +1 Throw), The Tilt (each Reroll also rerolls a held die), The Arm (scoring a hand lowers its level).

Antes 1-2 skip The Wall, House Dice, The Iron Hand and The Arm. The Ante 8 boss is **The House**: two rules at once (never The Wall, The Short Stack or The Iron Hand) and a x1.5 target. Softer rules (The Pinch, The Shaver) lower the target by 15%.

## Economy

- Table rewards $3 / $4 / $5, plus $1 per unused Throw, plus interest ($1 per $5 held, max $5).
- Shop: 3 mixed slots (65% charm, 20% cocktail, 8% token, 7% trick), 1 die, 2 packs, 1 upgrade per ante ($10). Restock starts at $5 and rises $1 each time.
- Packs ($4-5): Charm Box, Cocktail Menu, Token Pouch, Dice Cup, Trick Deck. Pick 1 of 3.
- Upgrades: Extra Throw, Deep Breath (+1 Reroll), Big Cup, Charm Rack, Bar Tab, Clearance, Restock Deal, The Vault, Dice Rack.

## Shooters (starting profiles)

| Shooter | Start |
|---|---|
| The Rookie | Five standard dice, $4 |
| The Hustler | Two Loaded dice, $4 |
| The Gemini | Four dice, one of them a Twin (5 dice thrown, a free Cup slot) |
| The Tinker | Steady Hand and a Chisel, $2 |
| The Minimalist | Four dice and Light Pockets |
| The Whale | $10 and a Lucky Penny, targets x1.75 |

Stakes: White (base), Red (targets +25%), Green (plus one fewer Reroll), Black (plus no interest, targets +40%).

## Targets

Ante base: 200, 500, 1100, 2200, 3600, 6000, 11000, 20000 (then x1.9 per ante in endless). Tables multiply it by 1 / 1.5 / 2.

## Simulation results

`npm run sim`, 300 seeded runs per row, white stake.

| Profile / bot | Avg progress | Reach A2 | Reach A5 | Reach A8 | Win |
|---|---|---|---|---|---|
| Rookie / random | 2.8 | 44% | 18% | 2% | 0% |
| Rookie / basic (holds the most common face) | 4.2 | 81% | 33% | 3% | 1% |
| Rookie / smart | 5.7 | 90% | 51% | 30% | 19% |
| Hustler / smart | 6.2 | 92% | 58% | 37% | 23% |
| Gemini / smart | 6.1 | 90% | 57% | 42% | 31% |
| Tinker / smart | 6.0 | 95% | 55% | 32% | 22% |
| Minimalist / smart | 4.4 | 89% | 29% | 11% | 7% |
| Whale / smart | 5.7 | 99% | 51% | 22% | 14% |
| Rookie / smart, Black stake | 3.2 | 71% | 15% | 2% | 0.3% |

The smart bot picks holds by Monte Carlo over a handful of candidate keeps (sets, two pairs, straight windows), spreads its reroll pool across throws, and buys charms by price and rarity. It knows nothing about synergies, so a thoughtful human should beat it.

Boss difficulty, smart bot loss rate when facing each rule: The Iron Hand was 34% before it gained +1 Throw; The Shaver and The Pinch were 21-25% before their target discount; the rest sit at 4-13%, with The Wall intentionally at ~21%.

## Balance goals (verified by sim)

- Skill beats luck: smart > basic > random at every depth (tested in `tests/fuzz.test.ts`).
- Ante 1 is gentle: a smart player clears the first table 99% of the time.
- Pit Bosses are where runs end, not the warm-up tables.
- Every starting shooter can win; the Minimalist is the hard mode.
