import softGeometric from './assets/soft-geometric.jpg'
import whiteLines from './assets/white-lines.jpg'
import grayTexture from './assets/gray-texture.jpg'

export const BACKGROUNDS = [
  { id: 'warm', label: '暖灰', color: '#e6e5e0', image: null },
  { id: 'geometric', label: '浅几何', color: '#e9e3e0', image: softGeometric },
  { id: 'lines', label: '白色线条', color: '#dce1e9', image: whiteLines },
  { id: 'texture', label: '深灰纹理', color: '#525957', image: grayTexture },
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
