// Capability: skyline packing.
//
// Generic over the layout family. A capability answers "where could this photo
// go"; this decides which of those spots to actually take, tracking the skyline
// of the columns so far. It is the only place that mutates placement state, which
// is what lets every capability stay a pure function.
//
// Two terms drive it:
//   · notch  — the gap a tile would seal under itself. Closing a shallow notch is
//              good; bridging a deep one is what produces the "missing corner"
//              the reference never shows, so it is priced far higher.
//   · centre — the block is fullest in the middle and steps back down toward both
//              edges (supplied by the capability as part of its own cost).
// A small downward bias lets a tile sit higher when its column is far behind,
// which keeps the silhouette stepped rather than a flat wall. It must stay mild:
// pricing block height here makes the packer fold everything into a narrow
// two-column stripe just to avoid growing.

const SHALLOW_WEIGHT = 1.2
const HOLLOW_WEIGHT = 6
const HOLLOW_SHARE = 0.4
const DRIFT_WEIGHT = 0.02

export function pack(queue, capability, { cols, colW, gutter, random }) {
  const pitch = colW + gutter
  const heights = new Array(cols).fill(0)
  const tiles = []
  let pool = queue.slice()
  let guard = 0

  while (pool.length && guard < 400) {
    guard += 1
    let chosen = null

    for (const item of pool) {
      for (const candidate of capability.candidates(item, { cols, colW, gutter, heights })) {
        let shallow = 0
        let hollow = 0
        for (let c = candidate.start; c < candidate.start + candidate.span; c += 1) {
          const gap = candidate.base - heights[c]
          if (gap <= candidate.height * HOLLOW_SHARE) shallow += gap
          else hollow += gap
        }

        const cost = candidate.cost
          + shallow * SHALLOW_WEIGHT
          + hollow * HOLLOW_WEIGHT
          + (candidate.base - heights[0]) * DRIFT_WEIGHT
          + (random() - 0.5) * 0.1

        // `tier` lets a future capability demand a hard preference; the span grid
        // never sets it, so this reduces to "cheapest wins".
        const tier = candidate.tier || 0
        if (!chosen || tier < chosen.tier || (tier === chosen.tier && cost < chosen.cost)) {
          chosen = { item, ...candidate, cost, tier }
        }
      }
    }

    if (!chosen) break
    for (let c = chosen.start; c < chosen.start + chosen.span; c += 1) {
      heights[c] = chosen.base + chosen.height + gutter
    }
    tiles.push({
      item: chosen.item,
      x: chosen.start * pitch,
      y: chosen.base,
      width: chosen.width,
      height: chosen.height,
    })
    pool = pool.filter((item) => item !== chosen.item)
  }

  if (pool.length) return null

  const bounds = {
    left: Math.min(...tiles.map((tile) => tile.x)),
    top: Math.min(...tiles.map((tile) => tile.y)),
    right: Math.max(...tiles.map((tile) => tile.x + tile.width)),
    bottom: Math.max(...tiles.map((tile) => tile.y + tile.height)),
  }
  return { tiles, heights, bounds, gutter }
}
