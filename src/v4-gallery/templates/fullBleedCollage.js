// Template: 满幅拼贴 / Full-bleed collage.
//
// A different kind of sheet from the templates before it. Those print an editorial
// page: a reserved block of photos, typography above and below it, and a canvas tall
// enough (4:5) to hold both. This one prints PAPER — a 4:3 landscape sheet with
// nothing on it but instant prints, covering it edge to edge.
//
// That difference is why the template carries two things the others do not:
//
//   · `board.ratio: [4, 3]`, so the solver resolves a landscape sheet instead of the
//     portrait one. The coordinate conversion it needs — a 4:3 board relates its two
//     axes by 3/4, not 4/5 — lives in ../board.js, not in this file and not in the
//     solver;
//   · `cluster.bleed`, because a pile of prints that stops politely inside the paper
//     is exactly what the reference is not. The outer prints are meant to run off the
//     edge.
//
// `fields` is absent on purpose. This sheet has no title, date, caption or
// signature: the photos are the whole composition. A template declares its own
// typography, so the honest way to say "none" is to declare none.
//
// Like every template, this file is pure data. Every number below describes a
// RELATIONSHIP — how many cards share a row, how much they stack, how far the pile
// may bleed — and the solver re-solves the actual positions and shapes from the
// photos that are uploaded.

export default {
  id: 'full-bleed-collage',
  label: '满幅拼贴',

  // The landscape sheet. 100 width units across, 75 down.
  board: { ratio: [4, 3] },

  suggest: {
    photos: [10, 13],
    orientation: '横图竖图都可以',
  },

  // The stacking family. No algorithm lives in this file.
  pipeline: ['collage-pile'],

  cluster: {
    // The whole sheet, declared the way CSS thinks about it — percent of board
    // HEIGHT — because "the whole sheet" is a statement about the two axes having no
    // reservation on them at all. Written in width units (the default for every other
    // template) the bottom edge of a 4:3 sheet would read as 100 against a board only
    // 75 units tall, which is out of bounds for a reason that has nothing to do with
    // the composition.
    zone: { left: 0, right: 100, top: 0, bottom: 100 },
    verticalAxis: 'height',
    // A sheet of paper is bigger than the frame the photo is printed on, and this is
    // both the contract's tolerance and the fit's budget. The number is not the fit's
    // overshoot alone: a card turned twelve degrees paints a box up to a fifth wider
    // than its own, so the allowance has to cover the overshoot PLUS the corner a
    // tilted card adds, or a layout that looks perfectly correct reports as out of
    // bounds. That is why it reads as a generous number for a pile that overshoots by
    // three percent.
    bleed: 30,
    // Unused by this family, which measures its own gaps; declared because every
    // skeleton has one and the schema checks it.
    gutter: [1, 1.5],

    // How many rows the pile reads as. More rows means smaller cards; fewer means
    // the prints grow until they stop reading as instant prints at all. The solver
    // picks the row count that fills the sheet best, so this is a range of intents
    // rather than a decision.
    perRow: [3, 5],

    // How much neighbours cover each other, as a share of a card's width. This is
    // the horizontal stack, and the reason the reference reads as one pile instead
    // of a contact sheet: at zero the cards sit in tidy columns.
    overlap: [0.18, 0.32],

    // How much of the sheet the PHOTOS end up covering, and how wide each one prints.
    // These two pull against each other and neither can be won outright: covering more
    // of the sheet means more photos or bigger ones, and bigger ones on a fixed sheet
    // means fewer of them. The floor is the promise; the ceiling is loose on purpose,
    // because a tight one is an optimum the solver reaches by shrinking the prints,
    // and the width floor below is what really holds the density in place.
    coverage: [0.6, 0.9],
    photoShare: [0.2, 0.32],

    // The tilt. Wide on purpose — a hand-laid pile is never square to the page, and
    // the turned corners are what let neighbouring cards fall across each other
    // instead of sitting in rows.
    tilt: 12,

    // How far a card may sit off its slot, as a share of the slot. Small: this is
    // "dropped by hand", not "scattered".
    jitter: 0.03,

    // The tallest card, as height / width. Roughly a square print with a caption
    // lip. A photo too tall for this is cropped inside its card rather than the card
    // being stretched, and it is reported as a crop.
    frameTallest: 1.34,
  },

  // Checked on every solve, on top of the shared invariants in contract.js.
  contract: {
    // The pile has to claim the sheet. A pile that only reaches 90% of the width
    // still leaves a strip of bare paper down each side, which is the one thing a
    // full-bleed sheet must not show.
    cluster: { width: [0.96, 1.04], height: [0.96, 1.04] },
    // Prints are meant to cover one another here. Overlap is a design element, not a
    // defect; the cap only stops a set collapsing into a single buried card.
    overlap: { allowed: true, maxCovered: 0.34 },
  },

  // No typography. The sheet is paper.
  fields: {},
}
