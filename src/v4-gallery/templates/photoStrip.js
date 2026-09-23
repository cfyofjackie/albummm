// Template: 相片条 / Photo strip.
//
// Same photos, same typography, different layout family. Where `today-moment`
// packs photos against a skyline on a fixed column pitch — which is what makes it
// read as a tidy grid of equal-width blocks — this one uses the technique the
// reference layouts actually use: photos group into rows, and each row's height is
// *solved* so that the widths (height x the photo's own ratio) fill the row
// exactly.
//
// The visible consequences:
//   · within a row every photo has the same height, and widths vary with each
//     photo's ratio — so the block reads as an edited strip, not a grid;
//   · rows are full by construction, so the block is dense instead of notched;
//   · because the rows justify to slightly less than the reserved width, the block
//     keeps a margin and a portrait-leaning set stays vertical.
//
// Like every template, this file is pure data.

export default {
  id: 'photo-strip',
  label: '相片条',

  board: { ratio: [4, 5] },

  suggest: {
    photos: [6, 10],
    orientation: '横图竖图都可以',
  },

  pipeline: ['justified-rows'],

  cluster: {
    // Same reservation as today-moment: the typography bands decide where photos
    // may go, and the block is centred inside what is left.
    zone: { left: 11, right: 89, top: 15, bottom: 49.5 },
    gutter: [0.9, 1.5],
    // Rows justify to this share of the reserved width. Reaching the very edge
    // turns the block into a horizontal banner, which is the look to avoid on a
    // portrait-leaning set.
    justify: 0.84,
    // Block proportion to aim for. Portrait-leaning content lands near 1.0 without
    // help because more rows are needed; this mostly steers mixed sets.
    blockRatio: 1.05,
    // Past this on-screen flatness a tile reads as a rule rather than a photo.
    maxTileRatio: 3.2,
  },

  contract: {
    // Honest floors, measured across the input families this template receives.
    cluster: { width: [0.5, 0.82], height: [0.28, 0.55] },
  },

  // Identical typography to today-moment: the point of this template is the photo
  // technique, so the type is held constant and only the block changes.
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
