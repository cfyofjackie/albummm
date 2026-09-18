// PROTOTYPE — shared pagination rules for the V3 carousel experiment.
// Question: can a story keep loose random layouts while enforcing 2–4 photos
// per page and treating five pages as the default output length?

const aspectKind = (photo) => {
  const aspect = photo.width / photo.height
  if (aspect < .85) return 'portrait'
  if (aspect > 1.25) return 'landscape'
  return 'square'
}

function shuffle(values, random) {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

// 2 张页占主导；3 张页只负责补足数量；4 张页最多一次，作为整组的密度高点。
export function pageCountPlan(photoCount, random = Math.random) {
  if (photoCount <= 0) return []
  if (photoCount <= 3) return [photoCount] // 极少照片时允许例外，不拆成没有意义的空页。

  if (photoCount < 10) {
    const pairs = Math.floor(photoCount / 2)
    return photoCount % 2 ? [...Array(Math.max(0, pairs - 1)).fill(2), 3] : Array(pairs).fill(2)
  }

  // 从五页开始寻找：若要让 3 张页反客为主，宁可多加一页。
  for (let pages = 5; pages <= Math.ceil(photoCount / 2); pages += 1) {
    const maxThrees = Math.floor(pages * .4)
    const candidates = []
    for (let fours = 0; fours <= 1; fours += 1) {
      for (let threes = 0; threes <= maxThrees; threes += 1) {
        const twos = pages - threes - fours
        // 两图页必须多于三图页；否则宁可多加一页，也不让整组显得过满。
        if (twos <= threes || twos < 0) continue
        if (twos * 2 + threes * 3 + fours * 4 === photoCount) {
          candidates.push({ twos, threes, fours })
        }
      }
    }
    if (candidates.length) {
      const best = candidates.sort((a, b) => a.fours - b.fours || a.threes - b.threes)[0]
      const plan = shuffle([
        ...Array(best.twos).fill(2),
        ...Array(best.threes).fill(3),
        ...Array(best.fours).fill(4),
      ], random)
      // 四图页是整组里的一个“高点”，不让它落在开头或收尾。
      const fourIndex = plan.indexOf(4)
      if (fourIndex === 0 || fourIndex === plan.length - 1) {
        const target = Math.floor(plan.length / 2)
        ;[plan[fourIndex], plan[target]] = [plan[target], plan[fourIndex]]
      }
      return plan
    }
  }
  const pairs = Math.floor(photoCount / 2)
  return photoCount % 2 ? [...Array(Math.max(0, pairs - 1)).fill(2), 3] : Array(pairs).fill(2)
}

function compatibilityScore(group, candidate, candidateIndex, random) {
  const kinds = group.map(aspectKind)
  const kind = aspectKind(candidate)
  let score = candidateIndex * .075 + random() * .04
  if (group.length === 1) {
    const anchor = kinds[0]
    if ((anchor === 'portrait' && kind === 'landscape') || (anchor === 'landscape' && kind === 'portrait')) score -= 1
    else if (anchor !== kind) score -= .35
    else score += .18
  } else if (!kinds.includes(kind)) {
    score -= .55
  } else {
    score += .2
  }
  return score
}

// 保留上传顺序的叙事感：每页第一张取下一张，补位才在余下照片中找更相配的横竖图。
export function paginatePhotos(photos, random = Math.random) {
  const plan = pageCountPlan(photos.length, random)
  const remaining = [...photos]
  return plan.map((count) => {
    const group = [remaining.shift()]
    while (group.length < count && remaining.length) {
      let winner = 0
      let winnerScore = Infinity
      remaining.forEach((candidate, index) => {
        const score = compatibilityScore(group, candidate, index, random)
        if (score < winnerScore) {
          winner = index
          winnerScore = score
        }
      })
      group.push(remaining.splice(winner, 1)[0])
    }
    return group.filter(Boolean)
  }).filter((group) => group.length)
}
