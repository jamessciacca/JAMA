import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section className="hero-card">
      <div className="hero-intro">
        <span className="eyebrow">JAMA</span>
        <h1>The smart hub for website and infrastructure checks.</h1>
        <p>
          JAMA gives you a clean, professional interface for monitoring site availability, tracking network health, and building a polished management portal.
          Start with a website health checker and expand later into more services.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" to="/checker">
            Check a website
          </Link>
          <a className="secondary-button" href="#features">
            Explore features
          </a>
        </div>
      </div>

      <div className="feature-grid" id="features">
        <article className="feature-item">
          <h2>Website health</h2>
          <p>Quickly test a website's reachability, HTTP status, and response time.</p>
        </article>
        <article className="feature-item">
          <h2>Modern UI</h2>
          <p>A structured layout with clear navigation for a professional look and feel.</p>
        </article>
        <article className="feature-item">
          <h2>Built for expansion</h2>
          <p>Start with one service and extend JAMA into a full device and network hub.</p>
        </article>
      </div>
    </section>
  );
}
