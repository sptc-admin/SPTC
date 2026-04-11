export function capitalizeWords(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text) return '';
  return text.replace(/(^|[\s\-'])([a-z])/g, (_, p1: string, p2: string) => {
    return `${p1}${p2.toUpperCase()}`;
  });
}

export function capitalizeFullName<T extends { first: string; middle: string; last: string; suffix: string }>(
  fullName: T,
): T {
  return {
    ...fullName,
    first: capitalizeWords(fullName.first ?? ''),
    middle: capitalizeWords(fullName.middle ?? ''),
    last: capitalizeWords(fullName.last ?? ''),
    suffix: capitalizeWords(fullName.suffix ?? ''),
  };
}
