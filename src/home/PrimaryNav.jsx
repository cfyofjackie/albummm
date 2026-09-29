import './primaryNav.css'

export default function PrimaryNav({ active }) {
  return (
    <nav className="primary-nav" aria-label="主要页面">
      <a href="#/" aria-label="开始创作" aria-current={active === 'home' ? 'page' : undefined} className={active === 'home' ? 'active' : ''}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="6.5" y="5.5" width="11" height="15" rx="2" /><path d="M8.5 5.5V4c0-.6.4-1 1-1h5c.6 0 1 .4 1 1v1.5" /><path d="M6.5 10.5h11" opacity="0.55" /></svg>
      </a>
      <a href="#/works" aria-label="我的作品" aria-current={active === 'works' ? 'page' : undefined} className={active === 'works' ? 'active' : ''}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3.5" y="8" width="13.5" height="10.5" rx="1.8" transform="rotate(-5 10.2 13.2)" opacity="0.5" /><rect x="6.5" y="6.5" width="14" height="11" rx="1.8" /></svg>
      </a>
    </nav>
  )
}
