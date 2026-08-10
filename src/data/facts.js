/**
 * Shown one at a time on the welcome board. Weighted towards India, since
 * that is where most of the guided tours on OGod run.
 */
export const TRAVEL_FACTS = [
  // --- India ---------------------------------------------------------
  'The Taj Mahal took about 22 years and more than 20,000 workers to finish.',
  'The Taj Mahal reads pink at dawn, white at midday and golden by moonlight.',
  'Varanasi is one of the oldest continuously inhabited cities on Earth.',
  "Kerala's backwaters form a maze of roughly 900 km of navigable waterways.",
  'India has more than 40 UNESCO World Heritage Sites.',
  'Jaipur was painted pink in 1876 to welcome the visiting Prince of Wales.',
  'Jodhpur is the Blue City, named for the indigo-washed houses of its old town.',
  'Jaisalmer Fort is one of very few forts in the world that people still live inside.',
  "Meghalaya's living root bridges are grown, not built — some take over 15 years.",
  'Mawsynram and Cherrapunji in Meghalaya are among the wettest places on Earth.',
  'The Kailasa temple at Ellora was carved downward out of one single rock.',
  'The Sundarbans is the largest mangrove forest anywhere in the world.',
  'Gir in Gujarat is the only place Asiatic lions still live in the wild.',
  "Kaziranga shelters around two-thirds of the world's one-horned rhinos.",
  'Goa was a Portuguese territory for over 450 years, right up until 1961.',
  "Ladakh's Pangong Tso shifts through blues and greens as the light moves.",
  'The Rann of Kutch dries after the monsoon into a vast white salt desert.',
  "The Golden Temple's kitchen serves free meals to tens of thousands every day.",
  'The Kumbh Mela is the largest gathering of people anywhere on the planet.',
  'The Darjeeling Himalayan Railway "toy train" has been running since the 1880s.',
  'The Western Ghats are geologically older than the Himalayas.',
  "Konark's Sun Temple is shaped like a chariot, and its stone wheels tell the time.",
  "Hampi's boulder-strewn ruins were once the capital of the Vijayanagara Empire.",
  'The Ajanta caves lay forgotten in forest until a hunting party stumbled on them in 1819.',
  'Rishikesh, on the banks of the Ganges, is widely called the yoga capital of the world.',
  'Chail in Himachal Pradesh has the highest cricket ground in the world.',
  'Khardung La in Ladakh is one of the highest motorable passes on Earth.',
  'India stretches nearly 3,000 km east to west but keeps a single time zone.',
  "Madurai's Meenakshi temple is covered in thousands of brightly painted sculptures.",
  'The Valley of Flowers in Uttarakhand blooms with hundreds of alpine species each monsoon.',

  // --- Elsewhere -----------------------------------------------------
  "The world's shortest scheduled flight lasts about 90 seconds, in Scotland's Orkney Islands.",
  'Vatican City is the smallest country on Earth, at around half a square kilometre.',
  'Russia stretches across eleven time zones.',
  'Canada has the longest coastline of any country in the world.',
  'The shore of the Dead Sea is the lowest dry land on Earth.',
  'Iceland has no mosquitoes.',
  'Angkor Wat in Cambodia is the largest religious monument ever built.',
  'The Great Barrier Reef is the largest living structure on the planet.',
  'Mount Everest grows by a few millimetres every year.',
  'Venice stands on millions of wooden piles driven into the lagoon floor.',
  'Bhutan measures national success by Gross National Happiness.',
  'The Sahara is roughly the size of the United States.',
  'The Maldives is the lowest-lying country in the world.',
  "Japan's bullet trains measure their average delay in seconds.",
  'Petra in Jordan was carved straight into rose-coloured sandstone cliffs.',
  'Antarctica is the only continent with no permanent residents.',
  'The Trans-Siberian Railway crosses eight time zones on a single ticket.',
  'The Spanish never found Machu Picchu, which is why so much of it survived.',
  "Singapore Changi Airport has an indoor waterfall over 40 metres tall.",
  'A hotel in northern Sweden is rebuilt out of ice and snow every winter.',
]

export function randomFact() {
  return TRAVEL_FACTS[Math.floor(Math.random() * TRAVEL_FACTS.length)]
}
