import './home.css'

// 产品首页：两个并列的作品入口。V3 与 V5 目前不分主次，靠用户反馈决定产品重心。
export default function HomePage() {
  return (
    <main className="home">
      <header className="home__brand">
        <span className="home__wordmark">Albummm</span>
      </header>

      <section className="home__intro">
        <h1>把一组照片，排成一件可以分享的作品。</h1>
        <p>选一种作品类型直接开始。照片只在本机处理，不会上传。</p>
      </section>

      <nav className="home__entries" aria-label="选择作品类型">
        <a className="home__card" href="#/story">
          <span className="home__thumb home__thumb--story" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="home__card-eyebrow">多页故事</span>
          <span className="home__card-title">一组可以连续翻看的页面</span>
          <span className="home__card-desc">照片自动分页排版，横着逐页查看，可按 4:5、3:4、4:3 逐页导出。</span>
          <span className="home__card-go">开始创作<span aria-hidden="true"> →</span></span>
        </a>

        <a className="home__card" href="#/collage">
          <span className="home__thumb home__thumb--collage" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span className="home__card-eyebrow">单张拼贴</span>
          <span className="home__card-title">一张横版或竖版拼贴</span>
          <span className="home__card-desc">十张照片排进 4:3 或 3:4 画面，点开看高清原图，也可导出整张作品。</span>
          <span className="home__card-go">开始创作<span aria-hidden="true"> →</span></span>
        </a>
      </nav>

      <footer className="home__foot">
        <p>更多作品类型仍在实验中。</p>
      </footer>
    </main>
  )
}
