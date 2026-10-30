import {
  AdventureIcon,
  BackpackIcon,
  BeachIcon,
  CityIcon,
  CultureIcon,
  FoodIcon,
  LuxuryIcon,
  MountainsIcon,
  RoadTripIcon,
  WildlifeIcon,
} from '../components/icons.jsx'

// `image` is the stand-in cover for a trip posted without one (public/images/categories).
export const TRIP_CATEGORIES = [
  { label: 'Mountains', Icon: MountainsIcon, image: 'mountains' },
  { label: 'Beach', Icon: BeachIcon, image: 'beach' },
  { label: 'Road Trips', Icon: RoadTripIcon, image: 'road-trips' },
  { label: 'Wildlife', Icon: WildlifeIcon, image: 'wildlife' },
  { label: 'City & Urban', Icon: CityIcon, image: 'city' },
  { label: 'Adventure', Icon: AdventureIcon, image: 'adventure' },
  { label: 'Culture', Icon: CultureIcon, image: 'culture' },
  { label: 'Backpacking', Icon: BackpackIcon, image: 'backpacking' },
  { label: 'Luxury', Icon: LuxuryIcon, image: 'luxury' },
  { label: 'Food & Cuisine', Icon: FoodIcon, image: 'food' },
]

export const CATEGORY_ICON = Object.fromEntries(
  TRIP_CATEGORIES.map(({ label, Icon }) => [label, Icon]),
)

const CATEGORY_IMAGE = Object.fromEntries(
  TRIP_CATEGORIES.map(({ label, image }) => [label, `/images/categories/${image}.jpg`]),
)

/** The photo shown for a trip when it has no cover of its own (or its cover fails to load). */
export function categoryImage(category) {
  return CATEGORY_IMAGE[category] ?? CATEGORY_IMAGE.Mountains
}

export const DIFFICULTIES = ['easy', 'moderate', 'challenging', 'strenuous']

export const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Hindi',
  'Mandarin',
  'Japanese',
  'Korean',
  'Arabic',
  'Swahili',
  'Thai',
  'Indonesian',
  'Nepali',
]

/** Doc §7 lifecycle, plus the label and next-step actions each status offers. */
export const TRIP_STATUS = {
  draft: { label: 'Draft', tone: 'muted' },
  published: { label: 'Published', tone: 'info' },
  booking_open: { label: 'Booking open', tone: 'success' },
  booking_closed: { label: 'Booking closed', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  ongoing: { label: 'Ongoing', tone: 'info' },
  completed: { label: 'Completed', tone: 'muted' },
  archived: { label: 'Archived', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export const STATUS_ACTIONS = {
  draft: [{ status: 'published', label: 'Publish' }],
  published: [
    { status: 'booking_open', label: 'Open bookings' },
    { status: 'draft', label: 'Unpublish' },
  ],
  booking_open: [{ status: 'booking_closed', label: 'Close bookings' }],
  booking_closed: [
    { status: 'confirmed', label: 'Confirm trip' },
    { status: 'booking_open', label: 'Reopen bookings' },
  ],
  confirmed: [{ status: 'ongoing', label: 'Start trip' }],
  ongoing: [{ status: 'completed', label: 'Mark complete' }],
  completed: [{ status: 'archived', label: 'Archive' }],
  archived: [],
  cancelled: [],
}

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

/** How a traveler's own booking reads on their trip list (doc §6). */
export const BOOKING_STATUS = {
  pending: { label: 'Awaiting approval', tone: 'warn' },
  confirmed: { label: 'Upcoming', tone: 'success' },
  completed: { label: 'Attended', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

/** Doc §7: a trip can be cancelled at any stage before it starts. */
export const CANCELLABLE = ['draft', 'published', 'booking_open', 'booking_closed', 'confirmed']
