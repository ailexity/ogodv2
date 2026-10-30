import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// The app is laid out for phones and must not zoom. iOS Safari ignores
// `user-scalable=no` in the viewport tag, so its pinch gesture is blocked here
// too. Touch screens only, so desktop Safari's trackpad zoom still works.
if (window.matchMedia('(pointer: coarse)').matches) {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
