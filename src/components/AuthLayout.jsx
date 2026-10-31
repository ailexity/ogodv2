import { CheckIcon } from './icons.jsx'

/**
 * Shared shell for the signed-out screens: a mountain photo with the brand on
 * it, and the form on a sheet that overlaps the photo's bottom edge on phones.
 * From 900px the photo becomes a side panel with a short pitch.
 */

const POINTS = [
  'Every guide is ID-verified before they can post a trip',
  'Day-by-day itineraries, with the full price before you book',
  'Stories and photos from travellers who went',
]

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-image" aria-hidden="true" />
        <div className="auth-hero-shade" aria-hidden="true" />
        <div className="auth-hero-copy">
          <div className="auth-brand">
            <span className="brand-mark brand-mark-auth">O</span>
            <span className="brand-name">OGod</span>
          </div>
          <p className="auth-tagline">Travel with people who know the way.</p>
          <ul className="auth-points">
            {POINTS.map((point) => (
              <li key={point}>
                <span className="auth-point-icon" aria-hidden="true">
                  <CheckIcon />
                </span>
                {point}
              </li>
            ))}
          </ul>
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
