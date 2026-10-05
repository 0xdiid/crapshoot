# CRAPSHOOT: UI and Flow Design

## Direction

A full-screen game that borrows the look and feel of late-80s, early-90s black-and-white desktop software without pretending to be an operating system. The vocabulary: chunky Chicago-style type, pinstriped panel headers, 2px black lines with hard drop shadows, push buttons with a thick default ring, speech-balloon tips, dithered fills, and pixel icons in a 16-color palette. No menu bar, no logos, no fake desktop.

The game has its own voice and mascot. Lucky, a die with a face, grins when you clear a table and goes cross-eyed when you bust. Panels open with dotted zoom rectangles and the cursor becomes an hourglass while dice tumble.

Color stays disciplined: chrome is black, white and gray; content uses the 16-color palette. The background is a dark pixel casino carpet, the felt is a dithered green, and every icon is an emoji pushed through the palette with ordered dithering and a black outline, shown at double pixel size.

### Tokens

| Token | Hex | Use |
|---|---|---|
| black / white | `#000` / `#fff` | Chrome, text, outlines |
| gray ramp | `#eee` `#ddd` `#bbb` `#888` `#555` | Window bevels, disabled text, scroll tracks |
| desktop | `#666699` + `#7777aa` dither | Desktop pattern behind every window |
| felt | `#006411` + `#0a7a18` dither | The dice table |
| mac red | `#dd0806` | Mult, Throws, bosses |
| mac blue | `#0000d4` | Chips, Rerolls |
| mac yellow | `#fcf305` | Scoring dice, highlights |
| mac magenta | `#f20884` | Twin dice and their copies |
| mac green | `#1fb714` | Money |

Each hand has its own palette color (Pair white, Full House orange, Five of a Kind red...), used on its swatch, the scoreboard stripe and its callout.

Type: **Chicago** (ChicagoFLF, public domain) for menus, buttons, titles and every number. Geneva (system Geneva when present) for small body copy in tooltips and descriptions. Big callouts use Chicago with the Mac "Outline" and "Shadow" text styles.

Shape language: hard 1px black lines everywhere, 1px hard drop shadows (no blur), rounded rects only for push buttons and dice. Depth comes from System 7's gray bevels, never from soft shadows.

## Screen flow

```
Title ──New run──> Shooter select ──Deal me in──> Ante board ──Play──> Table
  │                                                ^    │               │
  ├─Continue────────────────────────────────────────┘   └─Dice Box      ├─won──> Payout ──Collect──> Shop ──Next table──> Ante board
  ├─How to play (4 cards)                                               └─lost─> Game over ──Run it back / Menu
  └─Settings (sound, speed, motion)                  Final boss won ──> Victory ──Keep throwing (endless) / Cash in
```

The game autosaves after every action. Continue resumes exactly (the RNG lives in the save).

## Screens

Run screens (board, table, shop) share a full-width top bar: the Crapshoot wordmark, context stats (ante, table, target or next table), money, and a Menu button that opens the pause dialog (Hands, How to Play, Settings, Save and Quit, Abandon).

### Title
Full-bleed on the carpet: a huge outlined wordmark, the pitch, three tumbling dice and a panel with Continue or New Run as the default button, plus How to Play, Records and Settings.

### Shooter select
A "Pick your shooter" panel: shooter list with icons on the left, details on the right (starting Cup, cash, charms, comps), stakes as radio buttons, a seed field, and Cancel / Deal Me In.

### How to play
A panel paging through four cards, each with a small felt illustration.

### Ante board (between tables)
A "Tonight's tables" panel holding the three tables as framed felt swatches with targets, payouts and the boss rule in a red box. Each card lists its Throws, Rerolls and payout, and flags a boss that shrinks your Cup. The current table has the thick default-button frame and a Play button. Below: Cup, Charms and Comps palettes.

### Table (the main screen)
Desktop (landscape):
```
┌ top bar ─────────────────────────────────────────────────────────────────┐
│ Crapshoot  [Ante 2 of 8] [Table High Roller] [Target 900]      $14  Menu │
├──────────────┬───────────────────────────────────────────────────────────┤
│ Score        │ ═══ Throw 2 of 4 ═══                                      │
│  640 / 900   │ ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ back wall ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲        │
│ ▓▓▓▓▓▓░░░    │        FULL HOUSE   (callout slams in)                     │
│ ┌──────────┐ │                                                           │
│ │Full House│ │    [5]  [5]  [5]   [2]   [2]      3D dice in a row        │
│ │  Lv 2    │ │    HOLD HOLD  3     4     5        plates: key or HOLD     │
│ │ 60 × 6   │ │                                                           │
│ └──────────┘ │              CRAPSHOOT   (felt print)                     │
│ Throws ■■□□  ├───────────────────────────────────────────────────────────┤
│ Rerolls ●●○  │ Charms [🪙][🎺][ ][ ][ ]              Comps [⬆️][ ]      │
│ history      │                                                           │
├──────────────┴───────────────────────────────────────────────────────────┤
│ Your hand: [■ Full House 390] [Three of a Kind 160] [Pair 58]            │
│                                          ( Reroll 3 left ) ( Score 390 ) │
└──────────────────────────────────────────────────────────────────────────┘
```
Mobile (portrait): the top bar wraps money and Menu onto one row and the stats onto a second, then a compact scoreboard (score, hand, Throws and Rerolls), the felt at a fixed height, the rails, and the hand picker with Reroll and Score side by side at the bottom.

Key elements:
- **Dice row.** Every Throw tumbles the whole Cup onto the felt and settles into a row. Tap a die (or press its number) to hold it: it drops a step and its plate reads HOLD. Dice that make the selected hand get a yellow ring and a yellow plate.
- **Copies.** Twin dice and Double Down copies pop out of the die they came from, with dashed edges and a magenta COPY plate. They vanish after the Throw.
- **Hand picker.** Every hand the dice make, with its score preview, best first and preselected. Tap another to score that one instead. Hands voided by a boss show struck through at 0.
- **Reroll** (blue) rerolls every unheld die and shows how many are left for the table. **Score** (red) names the hand and its preview. Before a Throw, the red button reads Throw and the tray shows the Cup.
- **Tricks** used from the Comps palette put the felt into pick mode: a yellow banner, blinking dice, click one to apply, Cancel or Esc to back out.
- The hand isn't revealed until the dice land, so a Reroll never spoils itself.

### Payout
An ImageWriter printout on tractor-feed green-bar paper that prints line by line: table reward, unused Throws, interest, charm payouts, total. Primary: **Collect $N**.

### Shop ("The Back Room")
A panel with the cards laid out in two sections (For sale, Packs and upgrades) and a sticky footer: Restock, Dice Box, Next Table. Charms and Comps palettes float above it.

### Pack opening
A dialog: three cards flip in one by one. Take or Drink one, or Skip. Tricks from a Trick Deck go into your Comps for the next table. When slots are full the buttons say why and your Charms palette appears inside the dialog so you can sell.

### Dice Box
A dialog with the Cup tray, the Bench and a detail panel for the selected die (faces, mods, Bench it / Put in Cup, Fuse…, Sell). Drag dice between the Cup and the Bench; leaving a Cup slot empty is a real choice (Light Pockets). Fusion previews the result and lets you pick which die's faces to keep.

### Game over / Victory
Losing shows a "Run over" panel with busted Lucky and "The House Wins". Winning shows "Victory" with grinning Lucky. Both list run stats in a grid.

## Interaction rules

- Every action has one name everywhere: Throw, Reroll, Score, Buy, Sell, Take (from a pack), Skip, Fuse, Collect, Restock, Next table.
- Keyboard: Space/Enter throws or scores, R rerolls, 1-9 hold dice, D Dice Box, P hands table, Esc pause (or cancels a Trick pick).
- Input is locked while dice animate; tapping anywhere during the scoring cascade fast-forwards it.
- Errors explain themselves inline at the point of action ("Charm slots full: sell one first").
- Hover (desktop) or long-press (mobile) shows a tooltip for any die, hand, charm, comp or boss.

## Onboarding

No wall of text. Coach marks appear once each, dismissed by doing the thing:
1. Before the first Throw: "Throw every die in your Cup."
2. After it: "Tap dice to hold them. Reroll throws the rest. Rerolls are shared across the table."
3. Second Throw: "Your best hand is picked. Tap another hand to score that one instead."
4. Ante board: "Each ante has three tables..."
5. First shop: "Charms trigger on every Throw, left to right."

"How to play" on the title is four illustrated cards covering the same ground for anyone who wants it up front.

## Juice list

1. Dice fly in from the bottom edge, tumble in 3D, kiss the back wall and settle into a row. Clack sounds per bounce.
2. Twins split with a flash and a "Twin!" tag. Mirror dice flash when they copy.
3. Rerolls hop the unheld dice in place and spin them to new faces.
4. Landing a Full House or better straight out of the cup, or rerolling into one, slams in a callout.
5. Scoring: the hand name slams in with its color (confetti for Five of a Kind and up), idle dice dim, then each scoring die flashes and pops "+6" as the Chips and Mult counters tick with rising blips. Charms wiggle as they fire.
6. The total flies into the Score and a stream of chips follows. One throw that clears the whole table gets "ONE AND DONE".
7. Table cleared: grinning Lucky, pixel confetti in the Mac palette, and the target bar fills green.

Settings expose sound volume, animation speed (1x/2x/instant scoring), screen shake, and reduced motion (respects the OS preference by default).
