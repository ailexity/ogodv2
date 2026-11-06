import { api } from '../api/client.js'

/**
 * Confirms with the traveller (with an optional note for the guide) and
 * cancels their booking. Resolves to the updated booking, or null if they
 * backed out.
 */
export async function cancelBookingWithConfirm(booking, tripTitle) {
  const what = booking.status === 'confirmed' ? 'booking' : 'booking request'
  const paid = ['proof_sent', 'received'].includes(booking.paymentStatus)
  const reason = window.prompt(
    `Cancel your ${what} for ${tripTitle}?${paid ? ' Your guide will be asked to arrange your refund.' : ''}\n\nAdd a note for the guide (optional), then press OK.`,
    '',
  )
  if (reason === null) return null
  const { booking: updated } = await api.cancelBooking(booking.id, reason)
  return updated
}
