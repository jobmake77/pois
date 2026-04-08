interface HomeScreenProps {
  onOpenFiles: () => void;
}

export function HomeScreen({ onOpenFiles }: HomeScreenProps) {
  return (
    <main className="screen home-screen">
      <section className="hero-card home-hero">
        <div className="hero-copy">
          <p className="eyebrow">Pois Art / Photo Poster Studio</p>
          <h1>把照片做成一张会呼吸的波点海报</h1>
          <p className="hero-text">
            上传后直接进入编辑画板。单图默认是照片加填充块，双图默认直接并排展示；你可以继续切换布局、填充块和波点效果，然后导出高清图。
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={onOpenFiles}>
            上传照片开始
          </button>
        </div>
      </section>

      <section className="sample-showcase">
        <button type="button" className="sample-card" onClick={onOpenFiles}>
          <div className="sample-layout horizontal">
            <div className="sample-photo-pane sample-photo-a" />
            <div className="sample-fill-pane sample-fill-a" />
          </div>
          <div className="sample-info">
            <span className="sample-title">单图 + 填充块</span>
            <p>一张照片搭配填充块，波点装饰更完整。</p>
          </div>
        </button>
        <button type="button" className="sample-card" onClick={onOpenFiles}>
          <div className="sample-layout split">
            <div className="sample-photo-pane sample-photo-b" />
            <div className="sample-photo-pane sample-photo-c" />
          </div>
          <div className="sample-info">
            <span className="sample-title">双图编辑</span>
            <p>两张照片并排拼接，也能继续叠加波点风格。</p>
          </div>
        </button>
      </section>
    </main>
  );
}
