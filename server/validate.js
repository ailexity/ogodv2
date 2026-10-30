/** Empty means "not given"; anything else must be a whole number from 1 to 120. */
export function parseAge(value) {
  if (value === '' || value == null) return { age: null }
  const age = Number(value)
  if (!Number.isInteger(age) || age < 1 || age > 120) return { error: 'Enter a valid age' }
  return { age }
}
