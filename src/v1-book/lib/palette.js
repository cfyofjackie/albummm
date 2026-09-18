// 书布感封面色板：低饱和、有灰度（SLC.md 八）
// dark: true 表示该底色上用浅色文字
export const COVER_COLORS = [
  { id: 'oat', name: 'Oat', hex: '#d8cdb8', dark: false },
  { id: 'moss', name: 'Moss', hex: '#78806e', dark: true },
  { id: 'brick', name: 'Brick', hex: '#9c5a48', dark: true },
  { id: 'ink', name: 'Ink', hex: '#2e3743', dark: true },
  { id: 'ochre', name: 'Ochre', hex: '#bd9250', dark: true },
  { id: 'fog', name: 'Fog', hex: '#a9b2b8', dark: false },
  { id: 'wine', name: 'Wine', hex: '#6b3a46', dark: true },
  { id: 'paper', name: 'Paper', hex: '#e9e4d8', dark: false },
]

// 由 seed 确定性地分配封面色（重新生成时可换色）
export function pickCoverColor(seed) {
  let h = 2166136261
  const key = `cover-${seed}`
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return COVER_COLORS[(h >>> 0) % COVER_COLORS.length]
}
