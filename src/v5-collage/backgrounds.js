import softGeometric from './assets/soft-geometric.jpg'
import whiteLines from './assets/white-lines.jpg'
import grayTexture from './assets/gray-texture.jpg'
import softGeometricFocus from './assets/soft-geometric-focus.jpg'
import whiteLinesFocus from './assets/white-lines-focus.jpg'
import grayTextureFocus from './assets/gray-texture-focus.jpg'

export const BACKGROUNDS = [
  { id: 'warm', label: '暖灰', color: '#e6e5e0', image: null },
  { id: 'geometric', label: '浅几何', color: '#e9e3e0', image: softGeometric, focusImage: softGeometricFocus },
  { id: 'lines', label: '白色线条', color: '#dce1e9', image: whiteLines, focusImage: whiteLinesFocus },
  { id: 'texture', label: '深灰纹理', color: '#525957', image: grayTexture, focusImage: grayTextureFocus },
]

export function backgroundFor(id) {
  return BACKGROUNDS.find((item) => item.id === id) || BACKGROUNDS[0]
}

export function backgroundStyle(background) {
  return {
    backgroundColor: background.color,
    backgroundImage: background.image ? `url("${background.image}")` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}
