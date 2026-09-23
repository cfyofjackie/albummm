// Which photo proportions the product accepts, everywhere.
//
// One global rule rather than a per-template band. A per-template band would let
// each layout accept what it happens to handle well, but it makes the same photo
// valid for one template and refused by another — so switching template could
// suddenly reject the set the user just uploaded. For a tool aimed at ordinary
// users, one consistent rule is worth more than per-layout precision.
//
// The band is derived from the proportions people actually shoot, and 16:9 / 9:16
// were removed on purpose. They are shaped for screens, not for paper:
//
//     3:2      1.5000   <- widest accepted (the default landscape of most cameras)
//     4:3      1.3333   (the default of most phones)
//     1:1      1.0000   (square: no dominant axis, so it fits any region)
//     3:4      0.7500   (the default of most phones held upright)
//     2:3      0.6667   <- tallest accepted (also written 6:9)
//
// Refused: 16:9 / 9:16, and anything further out — 1:2, 1:3, 2:1, 21:9, 3:1. A
// polaroid frame is roughly square, so a 9:16 photo has to be cut down to fit it,
// and a 16:9 one sits in the frame with no presence. Neither is a good print.

export const MIN_RATIO = 2 / 3
export const MAX_RATIO = 3 / 2

// The named shapes the hint suggests, for the copy shown to users. Ordered from
// the easiest material outward, because square is genuinely the best case: it has
// no dominant axis, so it fits any region without fighting it.
export const RECOMMENDED_FORMATS = [
  { label: '1:1', ratio: 1, note: '方图最省心' },
  { label: '4:3', ratio: 4 / 3, note: '手机横拍' },
  { label: '3:4', ratio: 3 / 4, note: '手机竖拍' },
  { label: '3:2', ratio: 3 / 2, note: '相机横拍' },
  { label: '2:3', ratio: 2 / 3, note: '相机竖拍' },
]

// Shapes that are deliberately refused, named so the copy can be concrete. These
// are the ones users are most likely to upload without thinking.
export const REFUSED_FORMATS = [
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
]

// Tolerance when matching a photo against a named format, so a 4:3 shot that is a
// few pixels off still counts as 4:3.
const FORMAT_TOLERANCE = 0.04

export const ratioOf = (photo) => photo.aspect ?? photo.width / photo.height

export function isAcceptedRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return false
  return ratio >= MIN_RATIO - 1e-9 && ratio <= MAX_RATIO + 1e-9
}

// Which named format a photo is closest to, or null when it is not near any of
// them. Used for the hint and for telling a user what went wrong.
export function nearestFormat(ratio) {
  let best = null
  for (const format of RECOMMENDED_FORMATS) {
    const error = Math.abs(Math.log(ratio / format.ratio))
    if (error > FORMAT_TOLERANCE) continue
    if (!best || error < best.error) best = { ...format, error }
  }
  return best
}

// Split a batch into what can be used and what cannot, preserving order.
export function partitionByRatio(photos) {
  const accepted = []
  const rejected = []
  for (const photo of photos) {
    const ratio = ratioOf(photo)
    if (isAcceptedRatio(ratio)) accepted.push(photo)
    else rejected.push(photo)
  }
  return { accepted, rejected }
}

// The one-line hint shown wherever photos are chosen. Deliberately states the
// accepted shapes before upload rather than only complaining after a refusal, and
// names the refused ones because 16:9 / 9:16 are exactly what people upload without
// thinking about it.
export const RATIO_HINT = `支持 ${RECOMMENDED_FORMATS.map((f) => f.label).join(' / ')}。${REFUSED_FORMATS.map((f) => f.label).join(' 和 ')} 这类屏幕比例排不进去，请先裁成上面的比例。`

export function describeRejection(photos) {
  const labels = photos
    .map((photo) => {
      const ratio = ratioOf(photo)
      return `${photo.name || '未命名'}（${ratio.toFixed(2)}）`
    })
    .join('、')
  return `有 ${photos.length} 张照片的比例超出可用范围：${labels}。请换成 ${RECOMMENDED_FORMATS.map((f) => f.label).join(' / ')} 这类常规比例。`
}
