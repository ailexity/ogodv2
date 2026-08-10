/**
 * Shared shell for the signed-out screens: a mountain photo over a white
 * content column on phones, splitting into two columns from 900px up.
 */

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-image" aria-hidden="true" />
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
