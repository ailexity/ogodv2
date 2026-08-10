const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function CloseIcon() {
  return (
    <svg {...stroke}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function ChevronLeftIcon() {
  return (
    <svg {...stroke}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

export function ChevronRightIcon() {
  return (
    <svg {...stroke}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function SlidersIcon() {
  return (
    <svg {...stroke}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  )
}

export function CompassIcon() {
  return (
    <svg {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5Z" />
    </svg>
  )
}

export function ChevronUpIcon() {
  return (
    <svg {...stroke}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  )
}

export function ArrowUpIcon() {
  return (
    <svg {...stroke}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg {...stroke} strokeWidth="2.5">
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

export function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="m12 2 2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7L5.8 21l1.6-7L2 9.3l7.1-.7Z" />
    </svg>
  )
}

/** Doc §9: the verified badge shown on every guide profile and trip post. */
export function VerifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="m12 1.8 2.6 1.9 3.2-.2.9 3.1 2.6 1.9-1.3 3 1.3 3-2.6 1.9-.9 3.1-3.2-.2L12 22.2l-2.6-1.9-3.2.2-.9-3.1L2.7 15.5l1.3-3-1.3-3 2.6-1.9.9-3.1 3.2.2Z" />
      <path
        d="m8.5 12.2 2.4 2.4 4.6-4.9"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg {...stroke}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function HomeIcon() {
  return (
    <svg {...stroke}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg {...stroke} strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function TripsIcon() {
  return (
    <svg {...stroke}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  )
}

export function ProfileIcon() {
  return (
    <svg {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

export function MountainsIcon() {
  return (
    <svg {...stroke}>
      <path d="m3 20 6-11 4 6 3-4 5 9Z" />
    </svg>
  )
}

export function BeachIcon() {
  return (
    <svg {...stroke}>
      <path d="M2 16.5c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0" />
      <path d="M2 11.5c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0" />
      <circle cx="18" cy="5" r="2" />
    </svg>
  )
}

export function RoadTripIcon() {
  return (
    <svg {...stroke}>
      <path d="M5 11 6.5 6h11L19 11" />
      <rect x="3" y="11" width="18" height="6" rx="2" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </svg>
  )
}

export function WildlifeIcon() {
  return (
    <svg {...stroke}>
      <circle cx="7" cy="9" r="1.5" />
      <circle cx="12" cy="6.5" r="1.5" />
      <circle cx="17" cy="9" r="1.5" />
      <path d="M12 12c-3 0-5 2-5 4.3 0 1.5 1.2 2.4 2.6 1.9.9-.3 1.7-.3 2.4 0 1.4.5 2.6-.4 2.6-1.9C17 14 15 12 12 12Z" />
    </svg>
  )
}

export function CityIcon() {
  return (
    <svg {...stroke}>
      <rect x="4" y="3" width="7" height="18" />
      <rect x="13" y="8" width="7" height="13" />
      <path d="M7 7h1M7 11h1M7 15h1M16 12h1M16 16h1" />
    </svg>
  )
}

export function AdventureIcon() {
  return (
    <svg {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-1.8 5.2-5.2 1.8 1.8-5.2Z" />
    </svg>
  )
}

export function CultureIcon() {
  return (
    <svg {...stroke}>
      <path d="M4 21h16" />
      <path d="M5 21V9M9 21V9M15 21V9M19 21V9" />
      <path d="m3 9 9-5 9 5" />
    </svg>
  )
}

export function BackpackIcon() {
  return (
    <svg {...stroke}>
      <rect x="6" y="8" width="12" height="13" rx="3" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path d="M9 13h6" />
    </svg>
  )
}

export function LuxuryIcon() {
  return (
    <svg {...stroke}>
      <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 16.9 6.4 20l1.4-6.2L3 9.5l6.4-.6Z" />
    </svg>
  )
}

export function FoodIcon() {
  return (
    <svg {...stroke}>
      <path d="M7 3v6a2 2 0 1 0 4 0V3M9 9v12" />
      <path d="M18 3c-1.7 0-3 1.8-3 5s1.3 5 3 5v9" />
    </svg>
  )
}
