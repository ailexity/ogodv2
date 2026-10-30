import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons.jsx'

/** A password field with a show/hide toggle. Takes the same props as an <input>. */
export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </span>
  )
}
