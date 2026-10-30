import PDFDocument from 'pdfkit'

const INK = '#111114'
const SOFT = '#55555c'
const FAINT = '#8c8c93'
const BORDER = '#e6e6e9'

const GENDER_LABEL = { female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: '—' }

// The built-in PDF fonts have no ₹ glyph, so amounts use the currency code.
function money(amount, currency) {
  const value = Number(amount ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${value}`
}

export function bookingReference(id) {
  return `OGOD-${String(id).padStart(6, '0')}`
}

function sectionTitle(doc, title, x, y) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(title, x, y)
  return y + 24
}

/**
 * Streams a confirmed booking's ticket as a PDF with the OGod header.
 * `booking` is the API's booking shape (mapBooking); `guide` is the guide's row.
 */
export function renderTicket(booking, guide, stream) {
  const reference = bookingReference(booking.id)
  const { trip } = booking
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: { Title: `OGod ticket ${reference}`, Author: 'OGod' },
  })
  doc.pipe(stream)

  const pageWidth = doc.page.width
  const left = 50
  const width = pageWidth - 100

  // Header band with the OGod mark.
  doc.rect(0, 0, pageWidth, 96).fill(INK)
  doc.roundedRect(left, 30, 36, 36, 9).fill('#ffffff')
  doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text('O', left, 39, { width: 36, align: 'center' })
  doc.fontSize(24).fillColor('#ffffff').text('OGod', left + 48, 36)
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#c9c9cf')
    .text('BOOKING CONFIRMATION', left, 44, { width, align: 'right', characterSpacing: 1.5 })

  // Trip title and status.
  doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(trip.title, left, 126, { width })
  doc.font('Helvetica').fontSize(11).fillColor(SOFT).text(trip.destination, left, doc.y + 4, { width })

  let y = doc.y + 16
  doc.roundedRect(left, y, 92, 22, 11).fill('#e7f6ec')
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#1a7f37')
    .text('CONFIRMED', left, y + 7, { width: 92, align: 'center', characterSpacing: 1 })
  doc.font('Helvetica').fontSize(10).fillColor(SOFT).text(`Booking ref  ${reference}`, left + 108, y + 6)
  y += 46

  // Trip details, two columns.
  const dates = [trip.startDate, trip.endDate].filter(Boolean)
  const details = [
    ['Dates', dates.length ? [...new Set(dates)].join(' to ') : 'To be confirmed'],
    ['Duration', trip.durationDays ? `${trip.durationDays} ${trip.durationDays === 1 ? 'day' : 'days'}` : '—'],
    ['Meeting point', trip.meetingPoint || 'Your guide will confirm'],
    ['Travellers', String(booking.travelers)],
    ['Guide', guide.name],
    ['Guide phone', guide.phone || 'Message your guide in OGod'],
  ]
  const columnWidth = width / 2
  details.forEach(([label, value], index) => {
    const x = left + (index % 2) * columnWidth
    const rowY = y + Math.floor(index / 2) * 50
    doc.font('Helvetica').fontSize(8).fillColor(FAINT).text(label.toUpperCase(), x, rowY, { characterSpacing: 0.8 })
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(INK)
      .text(value, x, rowY + 13, { width: columnWidth - 20, height: 28, ellipsis: true })
  })
  y += Math.ceil(details.length / 2) * 50 + 6
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor(BORDER).stroke()
  y += 22

  // Travellers.
  y = sectionTitle(doc, 'Travellers', left, y)
  const columns = [
    ['Name', 0, 220],
    ['Age', 220, 60],
    ['Gender', 280, 90],
    ['Contact', 370, width - 370],
  ]
  doc.font('Helvetica').fontSize(8).fillColor(FAINT)
  for (const [label, offset, w] of columns) doc.text(label.toUpperCase(), left + offset, y, { width: w })
  y += 16
  for (const person of booking.party) {
    const contact = person.lead ? [person.phone, person.email].filter(Boolean).join('\n') : ''
    const cells = [
      `${person.name}${person.lead ? '  (lead)' : ''}`,
      person.age ? String(person.age) : '—',
      GENDER_LABEL[person.gender] ?? '—',
      contact,
    ]
    doc.font('Helvetica').fontSize(10).fillColor(INK)
    cells.forEach((cell, i) => {
      const [, offset, w] = columns[i]
      doc.text(cell, left + offset, y, { width: w - 8, height: 28, ellipsis: true })
    })
    y += contact.includes('\n') ? 34 : 22
  }
  y += 10
  doc.moveTo(left, y).lineTo(left + width, y).strokeColor(BORDER).stroke()
  y += 22

  // Payment.
  y = sectionTitle(doc, 'Payment', left, y)
  const currency = trip.currency
  const base = booking.totalPaid - booking.serviceFee - booking.tax
  const lines = [
    [`Trip fare (${booking.travelers} x ${money(trip.pricePerPerson, currency)})`, money(base, currency)],
    ['Service fee', money(booking.serviceFee, currency)],
    ['Taxes', money(booking.tax, currency)],
  ]
  for (const [label, value] of lines) {
    doc.font('Helvetica').fontSize(10).fillColor(SOFT).text(label, left, y)
    doc.text(value, left, y, { width, align: 'right' })
    y += 18
  }
  doc.moveTo(left, y + 2).lineTo(left + width, y + 2).strokeColor(BORDER).stroke()
  y += 12
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Total paid', left, y)
  doc.text(money(booking.totalPaid, currency), left, y, { width, align: 'right' })
  y += 22
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(FAINT)
    .text('Paid directly to your guide and verified by them in OGod messages.', left, y, { width })

  // Footer.
  const issued = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.moveTo(left, doc.page.height - 84).lineTo(left + width, doc.page.height - 84).strokeColor(BORDER).stroke()
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(FAINT)
    .text(
      `Show this ticket to your guide at the meeting point.   ·   ${reference}   ·   Issued ${issued}`,
      left,
      doc.page.height - 68,
      { width, align: 'center' },
    )

  doc.end()
}
