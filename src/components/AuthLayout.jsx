/**
 * Shared shell for the signed-out screens: an angled photo collage over a
 * white content column on phones, splitting into two columns from 900px up.
 */

// Nine tiles fill the rotated grid at every breakpoint without gaps showing.
// They are painted in CSS rather than fetched, so the app carries no stock
// photography and no external image dependency.
const COLLAGE_TILES = Array.from({ length: 9 }, (_, i) => i + 1)

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-collage" aria-hidden="true">
          {COLLAGE_TILES.map((tile) => (
            <span key={tile} className={`collage-tile collage-tile-${tile}`} />
          ))}
        </div>
        <div className="auth-hero-fade" aria-hidden="true" />
        <div className="auth-brand">
          <span className="brand-mark brand-mark-auth">O</span>
          <span className="brand-name">OGod</span>
        </div>
      </div>

      <div className="auth-body">
        <div className="auth-content">
          <div className="auth-heading">
            <h1 className="auth-title">{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </div>

          {children}

          {footer}
        </div>
      </div>
    </div>
  )
}
