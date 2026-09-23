// Template: 今日一刻 / Today moment.
//
// This skeleton is pure data. It was extracted from the hand-tuned solver that
// produced the approved layout, and the golden fixture in
// check/_v4/golden/todayMoment.json pins that output: this file must reproduce it
// exactly. If the abstraction cannot express a real, already-approved template,
// the abstraction is wrong — that is what this file is here to prove.
//
// It is a *block* skeleton, not a slot skeleton: the number of regions is not
// fixed. The structure comes from "one uniform column pitch, photos take as many
// columns as their ratio needs, packed tight against a stepped edge". That is why
// its suggestion below can honestly say landscape or portrait.

export default {
  id: 'today-moment',
  label: '今日一刻',

  board: { ratio: [4, 5] },

  // Shown on the template card before anything is uploaded. Derived from this file
  // by describeSuggestion(), so it cannot drift away from what the solver does.
  suggest: {
    photos: [6, 10],
    orientation: '横图竖图都可以',
  },

  // Which generic capabilities the solver runs. No algorithm lives in this file.
  pipeline: ['span-grid'],

  cluster: {
    // The room reserved for the photo block, in physical units (x and width as a
    // fraction of board width). Everything above and below is the typography.
    //
    // The bands below are the constraint, not a preference: the caption occupies
    // roughly 71%–93% of the canvas height and the header 3%–10%, so the block can
    // only use 15–52.5 in width units (52.5 / 0.8 = 65.6% of the board height).
    // A block scaled to fill that zone ends at exactly 52.5, and the caption starts
    // at 71% = 56.8 width units, which leaves the gap between them.
    //
    // Reserving room *below* where the caption actually starts is what previously
    // drove the block down on top of it; contract.js now checks this every solve.
    zone: { left: 11, right: 89, top: 15, bottom: 49.5 },
    // Gutter style: about 1% of the block width, which is the restraint that makes
    // the block read as one printed sheet rather than a UI grid.
    gutter: [0.9, 1.5],
    // Density intent: how many tile rows the block should read as, and how much
    // the unit may grow as more photos arrive. This is the "contact sheet, not a
    // few big bands" instruction. A higher row count means smaller tiles packed
    // more tightly, which is what the reference shows.
    unitScale: { rows: 7.5, base: 8, growth: 0.5 },
    cols: [1, 8],
  },

  // Checked on every solve, on top of the shared invariants in contract.js.
  // The height floor is deliberately permissive: with few photos the block cannot
  // reach the reserved height without inflating the tiles past the density
  // intent, and inflated tiles are the worse outcome.
  contract: {
    // Honest floors, measured from the widest and narrowest inputs this template
    // receives. An all-portrait set cannot reach the width an all-landscape set
    // does without growing taller than the caption band allows, and that trade is
    // settled in favour of the typography.
    cluster: { width: [0.45, 0.82], height: [0.28, 0.5] },
  },

  // Typography. A static preset for now: it exists so the photo block can be
  // judged inside the composition it was designed for, not as user data yet.
  // Every band is in percent of board height (what CSS `top` resolves against),
  // and contract.js checks that the solved block never intrudes into one.
  fields: {
    title: { anchor: 'top-left', content: 'Today' },
    subtitle: { anchor: 'top-left', content: 'moment' },
    meta: {
      anchor: 'top-right',
      lines: ['Rembang, Purbalingga', '02-02-2024'],
      band: { left: 55, right: 95, top: 3, bottom: 10 },
    },
    caption: {
      anchor: 'bottom-left',
      label: 'Dibalik kalimat',
      quote: '\u201Ceh, enak ya jadi kamu\u201D',
      body: [
        'Ada waktu yang hilang, tawa yang palsa,',
        'senyum yang terpaksa dan sakit yang sudah terbiasa.',
        'Tapi ajaibnya manusia, selalu punya cara tersendiri untuk',
        'pulih dan kembali tertawa. Jangan lupa bersyukur :)',
      ],
      band: { left: 0, right: 100, top: 64, bottom: 85 },
    },
    sign: { anchor: 'bottom-center', content: 'selwia__', band: { left: 30, right: 70, top: 86, bottom: 92 } },
  },
}
