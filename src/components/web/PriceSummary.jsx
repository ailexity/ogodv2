import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { formatMoney } from '../TripDetail.jsx'

/** Asks the server for the total, so the page never shows a price it won't charge. */
export function useQuote(tripId, travelers) {
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .quoteBooking(tripId, travelers)
      .then(({ quote: result }) => {
        if (cancelled) return
        setQuote(result)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setQuote(null)
        setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [tripId, travelers])

  return { quote, error }
}

export default function PriceSummary({ trip, travelers, quote, error }) {
  if (error) return <p className="form-error">{error}</p>
  if (!quote) return <p className="web-faint">Calculating price…</p>

  const currency = quote.currency ?? trip.currency
  return (
    <dl className="web-price">
      <div>
        <dt>
          {formatMoney(trip.pricePerPerson, currency)} × {travelers}{' '}
          {travelers === 1 ? 'traveller' : 'travellers'}
        </dt>
        <dd>{formatMoney(quote.base, currency)}</dd>
      </div>
      <div>
        <dt>Service fee</dt>
        <dd>{formatMoney(quote.serviceFee, currency)}</dd>
      </div>
      <div>
        <dt>Taxes</dt>
        <dd>{formatMoney(quote.tax, currency)}</dd>
      </div>
      <div className="web-price-total">
        <dt>Total</dt>
        <dd>{formatMoney(quote.total, currency)}</dd>
      </div>
    </dl>
  )
}
