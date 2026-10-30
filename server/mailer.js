import nodemailer from 'nodemailer'

const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587)
const FROM = process.env.MAIL_FROM ?? 'OGod <no-reply@ogod.app>'

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null

if (!transport) {
  console.warn(
    '[ogod] SMTP_HOST is not set — emails will not be sent. ' +
      'Verification and password-reset links are printed to this console instead.',
  )
}

/**
 * Where links in emails point. OGOD_APP_URL must be set in production: without
 * it the link is built from the request's Origin header, which a caller can
 * forge to send someone a reset link that leaks their token to another site.
 */
export function appUrl(req) {
  if (process.env.OGOD_APP_URL) return process.env.OGOD_APP_URL.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('OGOD_APP_URL must be set in production to send email links')
  }
  return req.get('origin') ?? `${req.protocol}://${req.get('host')}`
}

async function send({ to, subject, text, html }) {
  if (!transport) {
    console.log(`\n[ogod] Email to ${to} — ${subject}\n${text}\n`)
    return
  }
  await transport.sendMail({ from: FROM, to, subject, text, html })
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function layout(heading, body, action, rawUrl) {
  const url = escapeHtml(rawUrl)
  return `<!doctype html>
<html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1d24">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;padding:32px">
    <p style="font-weight:700;font-size:18px;margin:0 0 24px">OGod</p>
    <h1 style="font-size:22px;margin:0 0 12px">${heading}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 24px;color:#4a4f5c">${body}</p>
    <a href="${url}" style="display:inline-block;background:#1a1d24;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${action}</a>
    <p style="font-size:13px;line-height:1.5;margin:24px 0 0;color:#7a7f8c">Or paste this link into your browser:<br><span style="word-break:break-all">${url}</span></p>
    <p style="font-size:13px;margin:16px 0 0;color:#7a7f8c">If you didn't ask for this, you can ignore this email.</p>
  </div>
</body></html>`
}

export function sendVerificationEmail(to, name, url) {
  return send({
    to,
    subject: 'Confirm your email for OGod',
    text: `Hi ${name},\n\nConfirm your email to finish creating your OGod account:\n${url}\n\nThis link expires in 24 hours.`,
    html: layout(
      'Confirm your email',
      `Hi ${escapeHtml(name)}, tap the button below to finish creating your OGod account. This link expires in 24 hours.`,
      'Confirm email',
      url,
    ),
  })
}

export function sendPasswordResetEmail(to, name, url) {
  return send({
    to,
    subject: 'Reset your OGod password',
    text: `Hi ${name},\n\nUse this link to choose a new password:\n${url}\n\nThis link expires in 1 hour and can only be used once.`,
    html: layout(
      'Reset your password',
      `Hi ${escapeHtml(name)}, tap the button below to choose a new password. This link expires in 1 hour and can only be used once.`,
      'Choose a new password',
      url,
    ),
  })
}
