interface HomeScreenProps {
  onOpenFiles: () => void;
  onUseDemo: () => void;
}

export function HomeScreen({ onOpenFiles, onUseDemo }: HomeScreenProps) {
  return (
    <main className="screen home-screen">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Pois Art / Photo Poster Studio</p>
          <h1>把照片做成一张会呼吸的波点海报</h1>
          <p className="hero-text">
            上传图片后，自动生成上下双区海报。上半区保留主图，下半区用条纹或纯底叠加形状采样点，适合做社交分享图、氛围封面和情绪海报。
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={onOpenFiles}>
            上传照片开始
          </button>
          <button className="secondary-button" onClick={onUseDemo}>
            先看 Demo 效果
          </button>
        </div>
      </section>

      <section className="sample-showcase">
        <div className="sample-card sample-star">
          <div className="sample-top" />
          <div className="sample-bottom stripes-blue">
            <span className="sample-dot star-a" />
            <span className="sample-dot star-b" />
            <span className="sample-dot star-c" />
          </div>
        </div>
        <div className="sample-card sample-drop">
          <div className="sample-top soft-lilac" />
          <div className="sample-bottom solid-lilac">
            <span className="sample-dot drop-a" />
            <span className="sample-dot drop-b" />
          </div>
        </div>
      </section>
    </main>
  );
}
