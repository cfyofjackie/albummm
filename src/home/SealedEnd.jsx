import './sealedEnd.css'

// 完成流程的封存页：作品预览 + 「已存入我的作品」+ 两个去向。
// 全屏覆盖在创作页之上，参考胶卷项目 LightboxPage 的 sealed-end。
export default function SealedEnd({ previewSrc, previewRatio = 4 / 3, onWorks, onAnother }) {
  return (
    <div className="sealed-end" role="status">
      <span className={`sealed-end__preview ${previewRatio < 1 ? 'is-portrait' : ''}`}>
        {previewSrc && <img src={previewSrc} alt="作品预览" />}
      </span>
      <p>已存入我的作品</p>
      <div className="sealed-end-actions">
        <button type="button" className="btn" onClick={onWorks}>查看我的作品</button>
        <button type="button" className="btn quiet" onClick={onAnother}>再做一个</button>
      </div>
    </div>
  )
}
