interface HomeScreenProps {
  onOpenFiles: () => void;
}

export function HomeScreen({ onOpenFiles }: HomeScreenProps) {
  return (
    <main className="screen home-screen home-shell">
      <section className="hero-card home-hero reference-hero">
        <div className="hero-copy">
          <p className="eyebrow">Pois / Photo Poster Studio</p>
          <h1>做一张波点照片</h1>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={onOpenFiles}>
            上传照片开始
          </button>
        </div>
      </section>
    </main>
  );
}
