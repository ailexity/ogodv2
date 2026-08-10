// One-off demo-data seeder. Not run automatically — the app ships with no demo
// content by design (see db.js). Run manually with: node server/seed-demo.js
import { db } from './db.js'
import { hashPassword } from './password.js'

function upsertGuide() {
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get('guide@gmail.com')

  if (!user) {
    const result = db
      .prepare(
        `INSERT INTO users (email, password_hash, role, name, guide_status, certified, bio, languages, interests)
         VALUES (?, ?, 'guide', ?, 'verified', 1, ?, ?, ?)`,
      )
      .run(
        'guide@gmail.com',
        hashPassword('123456'),
        'Arjun Mehta',
        'Leading small-group trips across India for eight years — mountains, deserts, backwaters, all of it.',
        JSON.stringify(['English', 'Hindi']),
        JSON.stringify(['Mountains', 'Culture', 'Food & Cuisine']),
      )
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
    console.log(`created guide@gmail.com (id ${user.id})`)
  } else {
    db.prepare(
      `UPDATE users SET password_hash = ?, role = 'guide', guide_status = 'verified', certified = 1 WHERE id = ?`,
    ).run(hashPassword('123456'), user.id)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    console.log(`updated existing guide@gmail.com (id ${user.id}) to verified guide, password reset`)
  }

  return user
}

function img(keyword) {
  return `https://loremflickr.com/800/600/${keyword}`
}

const TRIPS = [
  {
    title: 'Triund Ridge Sunrise Trek',
    destination: 'Triund, Himachal Pradesh, India',
    category: 'Mountains',
    description:
      'A two-day trek up to the Triund ridge in the Dhauladhar range, camping under the stars with the snow line just above camp. Easy enough for a first-time trekker, spectacular enough for a seasoned one.',
    coverImage: img('himalayas,triund,mountains'),
    durationDays: 2,
    meetingPoint: 'McLeod Ganj bus stand, Dharamshala',
    minGroupSize: 2,
    maxGroupSize: 12,
    pricePerPerson: 3499,
    currency: 'INR',
    difficulty: 'moderate',
    languages: ['English', 'Hindi'],
    included: ['Camping gear', 'All meals on trail', 'Local trekking guide'],
    excluded: ['Transport to Dharamshala', 'Personal trekking gear'],
    highlights: ['Sunrise over the Dhauladhar range', 'Overnight camping at Triund', 'Views of the Kangra valley'],
    startDate: '2026-09-12',
    endDate: '2026-09-13',
    bookingDeadline: '2026-09-05',
    instantBook: true,
  },
  {
    title: 'Palolem Beach & South Goa Escape',
    destination: 'Palolem, South Goa, India',
    category: 'Beach',
    description:
      'A relaxed three-day stretch along South Goa’s quieter beaches — Palolem, Agonda and Patnem — with a dolphin cruise, beach shack dinners and a lot of doing absolutely nothing.',
    coverImage: img('goa,beach,india'),
    durationDays: 3,
    meetingPoint: 'Dabolim Airport (GOI), Goa',
    minGroupSize: 1,
    maxGroupSize: 10,
    pricePerPerson: 8999,
    currency: 'INR',
    difficulty: 'easy',
    languages: ['English', 'Hindi'],
    included: ['Beachfront hut stay', 'Dolphin cruise', 'Airport transfers'],
    excluded: ['Meals other than breakfast', 'Water sports'],
    highlights: ['Dolphin spotting cruise', 'Silent Noise beach party', 'Sunset at Agonda'],
    startDate: '2026-10-02',
    endDate: '2026-10-04',
    bookingDeadline: '2026-09-25',
    instantBook: true,
  },
  {
    title: 'Rajasthan Royal Road Trip',
    destination: 'Jaipur – Jodhpur – Udaipur, Rajasthan, India',
    category: 'Road Trips',
    description:
      'A six-day self-drive-style road trip through Rajasthan’s three great cities — the Pink City, the Blue City and the City of Lakes — forts, palaces and desert highways included.',
    coverImage: img('rajasthan,fort,india'),
    durationDays: 6,
    meetingPoint: 'Jaipur International Airport',
    minGroupSize: 2,
    maxGroupSize: 8,
    pricePerPerson: 24999,
    currency: 'INR',
    difficulty: 'moderate',
    languages: ['English', 'Hindi'],
    included: ['AC vehicle with driver', 'Heritage hotel stays', 'Fort entry tickets'],
    excluded: ['Lunches', 'Personal shopping'],
    highlights: ['Amber Fort at sunrise', 'Mehrangarh Fort, Jodhpur', 'Boat ride on Lake Pichola'],
    startDate: '2026-11-08',
    endDate: '2026-11-13',
    bookingDeadline: '2026-10-30',
    instantBook: false,
  },
  {
    title: 'Ranthambore Tiger Safari',
    destination: 'Ranthambore National Park, Rajasthan, India',
    category: 'Wildlife',
    description:
      'Two full days of jeep safaris through Ranthambore’s dry deciduous forest, tracking tigers, sloth bears and marsh crocodiles around the ruins of a 10th-century fort.',
    coverImage: img('tiger,safari,ranthambore'),
    durationDays: 2,
    meetingPoint: 'Sawai Madhopur railway station',
    minGroupSize: 2,
    maxGroupSize: 6,
    pricePerPerson: 12999,
    currency: 'INR',
    difficulty: 'easy',
    languages: ['English', 'Hindi'],
    included: ['4 jeep safaris', 'Naturalist guide', 'Resort stay'],
    excluded: ['Camera fees', 'Alcoholic beverages'],
    highlights: ['Tiger tracking with a naturalist', 'Ranthambore Fort ruins', 'Padam Talao lake'],
    startDate: '2026-12-05',
    endDate: '2026-12-06',
    bookingDeadline: '2026-11-28',
    instantBook: false,
  },
  {
    title: 'Old Delhi Heritage Walk',
    destination: 'Chandni Chowk, Old Delhi, India',
    category: 'City & Urban',
    description:
      'A half-day walking tour through the lanes of Shahjahanabad — Jama Masjid, spice markets, the Red Fort and a rickshaw ride through Chandni Chowk’s tangled bylanes.',
    coverImage: img('olddelhi,chandnichowk,india'),
    durationDays: 1,
    meetingPoint: 'Jama Masjid Gate 1',
    minGroupSize: 1,
    maxGroupSize: 15,
    pricePerPerson: 1499,
    currency: 'INR',
    difficulty: 'easy',
    languages: ['English', 'Hindi'],
    included: ['Local guide', 'Cycle rickshaw ride', 'Street food tastings'],
    excluded: ['Red Fort entry ticket'],
    highlights: ['Jama Masjid', 'Spice market at Khari Baoli', 'Parathe Wali Gali'],
    startDate: '2026-09-20',
    endDate: '2026-09-20',
    bookingDeadline: '2026-09-18',
    instantBook: true,
  },
  {
    title: 'Rishikesh Rafting & Yoga Weekend',
    destination: 'Rishikesh, Uttarakhand, India',
    category: 'Adventure',
    description:
      'White-water rafting on the Ganges, a cliff-jumping stop, and two sunrise yoga sessions on the riverbank — a weekend that mixes adrenaline with a bit of stillness.',
    coverImage: img('rishikesh,rafting,ganges'),
    durationDays: 2,
    meetingPoint: 'Rishikesh bus stand',
    minGroupSize: 4,
    maxGroupSize: 14,
    pricePerPerson: 5499,
    currency: 'INR',
    difficulty: 'challenging',
    languages: ['English', 'Hindi'],
    included: ['Rafting gear & guide', 'Camp stay', 'Yoga sessions'],
    excluded: ['Bungee jumping (optional add-on)'],
    highlights: ['16 km white-water rafting', 'Cliff jumping at Shivpuri', 'Sunrise yoga by the Ganges'],
    startDate: '2026-10-17',
    endDate: '2026-10-18',
    bookingDeadline: '2026-10-10',
    instantBook: true,
  },
  {
    title: 'Varanasi Ganga Aarti Experience',
    destination: 'Varanasi, Uttar Pradesh, India',
    category: 'Culture',
    description:
      'Three days along the ghats of the world’s oldest living city — a sunrise boat ride, the evening Ganga Aarti at Dashashwamedh Ghat, and a walk through the old city’s temples and alleys.',
    coverImage: img('varanasi,ganges,india'),
    durationDays: 3,
    meetingPoint: 'Varanasi Junction railway station',
    minGroupSize: 1,
    maxGroupSize: 10,
    pricePerPerson: 6999,
    currency: 'INR',
    difficulty: 'easy',
    languages: ['English', 'Hindi'],
    included: ['Sunrise boat ride', 'Guided old-city walk', 'Hotel stay'],
    excluded: ['Meals other than breakfast'],
    highlights: ['Dashashwamedh Ghat Aarti', 'Sunrise boat ride', 'Sarnath day trip'],
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    bookingDeadline: '2026-11-07',
    instantBook: false,
  },
  {
    title: 'Hampi Ruins Backpacking Trail',
    destination: 'Hampi, Karnataka, India',
    category: 'Backpacking',
    description:
      'Three days exploring the boulder-strewn ruins of the Vijayanagara Empire on foot and by bicycle, with a sunset from Matanga Hill and a night crossing the Tungabhadra by coracle.',
    coverImage: img('hampi,ruins,karnataka'),
    durationDays: 3,
    meetingPoint: 'Hospet railway station',
    minGroupSize: 2,
    maxGroupSize: 10,
    pricePerPerson: 5999,
    currency: 'INR',
    difficulty: 'moderate',
    languages: ['English', 'Hindi'],
    included: ['Guesthouse stay', 'Bicycle rental', 'Coracle ride'],
    excluded: ['Meals', 'Monument entry fees'],
    highlights: ['Virupaksha Temple', 'Sunset from Matanga Hill', 'Vittala Temple stone chariot'],
    startDate: '2026-12-12',
    endDate: '2026-12-14',
    bookingDeadline: '2026-12-05',
    instantBook: true,
  },
  {
    title: 'Kerala Backwaters Houseboat',
    destination: 'Alleppey, Kerala, India',
    category: 'Luxury',
    description:
      'A slow two-day drift through the Kerala backwaters aboard a private houseboat, with home-cooked Kerala meals, paddy-field villages, and a sunset over Vembanad Lake.',
    coverImage: img('kerala,backwaters,houseboat'),
    durationDays: 2,
    meetingPoint: 'Alleppey Finishing Point jetty',
    minGroupSize: 2,
    maxGroupSize: 6,
    pricePerPerson: 17999,
    currency: 'INR',
    difficulty: 'easy',
    languages: ['English', 'Hindi'],
    included: ['Private houseboat', 'All meals', 'Village canoe tour'],
    excluded: ['Alcoholic beverages', 'Ayurvedic massage'],
    highlights: ['Private sundeck houseboat', 'Sunset over Vembanad Lake', 'Canoe ride through paddy villages'],
    startDate: '2026-09-28',
    endDate: '2026-09-29',
    bookingDeadline: '2026-09-21',
    instantBook: false,
  },
  {
    title: 'Amritsar Street Food & Golden Temple',
    destination: 'Amritsar, Punjab, India',
    category: 'Food & Cuisine',
    description:
      'A two-day food crawl through Amritsar’s old city — kulcha, lassi and jalebi stalls that have run for generations — bookended by the Golden Temple langar and the Wagah border ceremony.',
    coverImage: img('goldentemple,amritsar,india'),
    durationDays: 2,
    meetingPoint: 'Golden Temple, Gate 1',
    minGroupSize: 1,
    maxGroupSize: 12,
    pricePerPerson: 4499,
    currency: 'INR',
    difficulty: 'easy',
    languages: ['English', 'Hindi', 'Punjabi'],
    included: ['Food crawl with local guide', 'Wagah border transport', 'Hotel stay'],
    excluded: ['Lunch on day 2'],
    highlights: ['Golden Temple langar', 'Kulcha crawl in the old city', 'Wagah border retreat ceremony'],
    startDate: '2026-10-24',
    endDate: '2026-10-25',
    bookingDeadline: '2026-10-17',
    instantBook: true,
  },
]

function seedTrips(guide) {
  const insert = db.prepare(
    `INSERT INTO trips (guide_id, title, destination, category, description, status, cover_image,
                        duration_days, meeting_point, min_group_size, max_group_size,
                        price_per_person, currency, difficulty, languages, included, excluded,
                        highlights, start_date, end_date, booking_deadline, instant_book)
     VALUES (@guide_id, @title, @destination, @category, @description, 'booking_open', @cover_image,
             @duration_days, @meeting_point, @min_group_size, @max_group_size,
             @price_per_person, @currency, @difficulty, @languages, @included, @excluded,
             @highlights, @start_date, @end_date, @booking_deadline, @instant_book)`,
  )

  let created = 0
  for (const trip of TRIPS) {
    const existing = db
      .prepare('SELECT id FROM trips WHERE title = ? AND guide_id = ?')
      .get(trip.title, guide.id)
    if (existing) continue

    insert.run({
      guide_id: guide.id,
      title: trip.title,
      destination: trip.destination,
      category: trip.category,
      description: trip.description,
      cover_image: trip.coverImage,
      duration_days: trip.durationDays,
      meeting_point: trip.meetingPoint,
      min_group_size: trip.minGroupSize,
      max_group_size: trip.maxGroupSize,
      price_per_person: trip.pricePerPerson,
      currency: trip.currency,
      difficulty: trip.difficulty,
      languages: JSON.stringify(trip.languages),
      included: JSON.stringify(trip.included),
      excluded: JSON.stringify(trip.excluded),
      highlights: JSON.stringify(trip.highlights),
      start_date: trip.startDate,
      end_date: trip.endDate,
      booking_deadline: trip.bookingDeadline,
      instant_book: trip.instantBook ? 1 : 0,
    })
    created += 1
  }
  console.log(`trips: created ${created}, skipped ${TRIPS.length - created} already present`)
}

const BLOGS = [
  {
    title: 'Camping under the Dhauladhar stars',
    location: 'Triund, Himachal Pradesh, India',
    content:
      'We reached the ridge just as the light went gold on the snow line. No signal, no noise — just tea brewing on a camp stove and the Dhauladhar peaks turning pink one at a time. Slept in a two-person tent with the flap open all night just to keep watching the sky. If you only do one trek in the Himalayas this year, make it this one — it rewards a moderate effort with a completely disproportionate view.',
    mediaKeyword: 'himalayas,camping,mountains',
  },
  {
    title: 'A slow week doing nothing on Palolem beach',
    location: 'Palolem, South Goa, India',
    content:
      'South Goa moves at a different speed than the north. Mornings were for walking the curve of Palolem beach before the shacks opened, afternoons for doing absolutely nothing under a palm-thatch umbrella. Caught dolphins on a sunrise boat ride on day two, then spent the rest of the week convinced that was the highlight — until the beach bonfire on our last night proved otherwise.',
    mediaKeyword: 'goa,beach,sunset',
  },
  {
    title: 'Sandcastles and starlit dinners in the Thar',
    location: 'Jaisalmer, Rajasthan, India',
    content:
      'The desert does something strange to sound — by the time we’d ridden the camels out past the last dune, Jaisalmer’s Golden Fort was just a smudge on the horizon and the only noise left was wind. Dinner was served on a dune under more stars than I’ve ever seen at once, with a Rajasthani folk singer who kept going long after we should have been asleep.',
    mediaKeyword: 'jaisalmer,desert,rajasthan',
  },
  {
    title: 'Sunrise on the ghats of Varanasi',
    location: 'Varanasi, Uttar Pradesh, India',
    content:
      'Nothing prepares you for a 5 a.m. boat ride past the ghats of Varanasi as the city wakes up — priests setting up for morning puja, buffalo wading into the Ganges, marigolds floating past the boat. By evening the same stretch of river turns into the Ganga Aarti, drums and fire and a few thousand people standing shoulder to shoulder. Same river, two completely different cities.',
    mediaKeyword: 'varanasi,ganges,sunrise',
  },
  {
    title: 'Three days adrift in the Kerala backwaters',
    location: 'Alleppey, Kerala, India',
    content:
      'Our houseboat driver cut the engine somewhere past the last paddy field and just let us drift for an hour. Fishermen in narrow canoes, kingfishers diving off the coconut palms, and a lunch of karimeen pollichathu cooked on board that I’m still thinking about. Kerala’s backwaters aren’t a sight you visit — they’re a pace you slow down into.',
    mediaKeyword: 'kerala,backwaters,boat',
  },
]

function seedBlogs(guide) {
  const insert = db.prepare(
    `INSERT INTO blogs (author_id, title, content, location, media_type, media_url)
     VALUES (?, ?, ?, ?, 'image', ?)`,
  )

  let created = 0
  for (const blog of BLOGS) {
    const existing = db
      .prepare('SELECT id FROM blogs WHERE title = ? AND author_id = ?')
      .get(blog.title, guide.id)
    if (existing) continue

    insert.run(guide.id, blog.title, blog.content, blog.location, img(blog.mediaKeyword))
    created += 1
  }
  console.log(`blogs: created ${created}, skipped ${BLOGS.length - created} already present`)
}

const guide = upsertGuide()
seedTrips(guide)
seedBlogs(guide)
