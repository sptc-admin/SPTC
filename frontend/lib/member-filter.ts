/** Case-insensitive substring match on body # and member name (both optional). */
export function matchesMemberFilter(
  bodyNumber: string,
  memberName: string,
  bodyFilter: string,
  nameFilter: string
): boolean {
  const b = bodyFilter.trim().toLowerCase()
  const n = nameFilter.trim().toLowerCase()
  if (b && !bodyNumber.toLowerCase().includes(b)) return false
  if (n && !memberName.toLowerCase().includes(n)) return false
  return true
}
