function AutoDecoration({ placement }) {
  const style = {
    left: `${placement.x}%`, top: `${placement.y}%`, width: `${placement.width}%`, height: `${placement.height}%`,
    transform: `rotate(${placement.rotate}deg)`,
  }
  if (placement.id === 'cat') return <svg className="v5-collage__auto-decoration" style={style} viewBox="0 0 120 100" aria-hidden="true"><path d="m25 37 8-22 16 14a42 42 0 0 1 22 0l16-14 8 22v25c0 19-15 29-35 29S25 81 25 62Z" /><path d="M45 56h1m29 0h1M54 70c4 4 8 4 12 0m-6-8v6m-8 0h16" /><path d="M25 61 6 54m19 15L5 73m90-12 19-7m-19 15 20 4" /></svg>
  if (placement.id === 'dog') return <svg className="v5-collage__auto-decoration" style={style} viewBox="0 0 120 100" aria-hidden="true"><path d="M33 33C14 28 11 48 25 59c-5 26 14 33 35 33s40-7 35-33c14-11 11-31-8-26L78 43H42Z" /><path d="M46 56h1m27 0h1M54 67c4 5 8 5 12 0m-6-8v6m-9 0h18" /><path d="M34 83c-11 2-17 6-21 11m73-11c11 2 17 6 21 11" /></svg>
  if (placement.id === 'flower') return <svg className="v5-collage__auto-decoration" style={style} viewBox="0 0 100 110" aria-hidden="true"><path d="M50 54v48m0-21c-13-1-21-8-25-18m25 27c13-1 21-8 25-18" /><path d="M50 56c-16 4-27-10-17-20-10-10 2-24 17-14 4-16 20-16 24 0 15-10 27 4 17 14 10 10-1 24-17 20Z" /><circle cx="50" cy="40" r="7" /></svg>
  return <svg className="v5-collage__auto-decoration" style={style} viewBox="0 0 120 90" aria-hidden="true"><path d="M13 29h94v48H13Z" /><path d="M39 29 47 18h26l8 11M13 43h20m54 0h20" /><circle cx="60" cy="53" r="17" /><path d="M60 44v18m-9-9h18" /></svg>
}

export function BoardDecorations({ enabled, autoPlacements }) {
  if (!enabled) return null
  return (
    <div className="v5-collage__decorations" aria-hidden="true">
      <svg className="v5-collage__doodle v5-collage__doodle--spark" viewBox="0 0 42 42"><path d="M21 3v12M21 27v12M3 21h12M27 21h12" /><path d="m8 8 7 7m12 12 7 7m0-26-7 7M15 27l-7 7" /></svg>
      <svg className="v5-collage__doodle v5-collage__doodle--heart" viewBox="0 0 42 42"><path d="M21 34C-2 21 9 4 21 15 33 4 44 21 21 34Z" /></svg>
      <svg className="v5-collage__doodle v5-collage__doodle--loop" viewBox="0 0 180 78"><path d="M5 56c16-29 36-36 52-23 19 15-11 37-19 10-7-24 32-38 54-16 21 21-12 39-22 13-8-20 26-39 49-22 22 16 1 40-18 21-13-12 15-37 40-18 14 10 14 24 31 29" /></svg>
      <p className="v5-collage__handwrite v5-collage__handwrite--top">little things</p>
      <span className="v5-collage__mini-note">✦</span>
      {autoPlacements.map((placement) => <AutoDecoration key={`${placement.id}-${placement.x}-${placement.y}`} placement={placement} />)}
    </div>
  )
}

export function CardDecoration({ index, enabled }) {
  if (!enabled) return null
  if (index === 0 || index === 6) return <span className={`v5-collage__washi v5-collage__washi--${index}`} aria-hidden="true" />
  if (index === 1) return <svg className="v5-collage__clip" viewBox="0 0 32 74" aria-hidden="true"><path d="M16 4C8 4 4 10 4 18v34c0 16 24 16 24 0V22c0-9-14-9-14 0v28c0 4 6 4 6 0V25" /></svg>
  return null
}
