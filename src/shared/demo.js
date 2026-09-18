// 演示模式：用 canvas 生成不同方向、带编号的测试图，走真实的 loadPhoto 管线。
// 入口：/?demo=N（N 为图片数量，5–20），加 &go 自动成书。

const DEMO_DIMS = [
  [2400, 1800], // landscape
  [1200, 1600], // portrait
  [3000, 1200], // ultra-wide
  [1400, 1400], // square
  [1200, 3000], // ultra-tall
  [1600, 1200],
  [1200, 1600],
  [4000, 1500], // ultra-wide
  [1600, 2000],
  [2000, 2000],
  [1200, 1600],
  [1600, 1200],
  [1800, 1800],
  [3200, 1300], // ultra-wide
  [1400, 1800],
  [1200, 1600],
  [2000, 1400],
  [1600, 1600],
  [1400, 2000],
  [1800, 1200],
]

const BG = ['#b8aa93', '#8a917f', '#a4756a', '#5d6b7a', '#bd9a5e', '#8f8f97', '#70505c', '#c9c2b2']

function drawNumber(canvas, i, [w, h]) {
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = BG[i % BG.length]
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  const fs = Math.min(w, h) * 0.3
  ctx.font = `500 ${fs}px Helvetica, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(i + 1), w / 2, h / 2)
  ctx.font = `400 ${fs * 0.08}px Helvetica, Arial, sans-serif`
  ctx.fillText(`${w}×${h}`, w / 2, h - fs * 0.2)
}

export async function makeDemoPhotos(count) {
  const files = await Promise.all(
    DEMO_DIMS.slice(0, count).map(
      ([w, h], i) =>
        new Promise((resolve) => {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          drawNumber(canvas, i, [w, h])
          canvas.toBlob(
            (blob) => resolve(new File([blob], `demo-${i + 1}.jpg`, { type: 'image/jpeg' })),
            'image/jpeg',
            0.9,
          )
        }),
    ),
  )
  const { loadPhoto } = await import('./photo.js')
  return Promise.all(files.map(loadPhoto))
}
