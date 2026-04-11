import type { MemberFullNameJson } from './member.entity';

const NAME_PART_MAX_LEN = 80;

export function normalizeMemberFullNameParts(
  fullName: MemberFullNameJson | Record<string, unknown>,
): MemberFullNameJson {
  const s = (v: unknown): string =>
    typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  const f = fullName as MemberFullNameJson;
  return {
    first: s(f.first),
    middle: s(f.middle),
    last: s(f.last),
    suffix: s(f.suffix),
  };
}

export function getMemberFullNameFormatError(fullName: unknown): string | null {
  if (fullName === null || fullName === undefined || typeof fullName !== 'object') {
    return 'Name is required.';
  }
  const n = normalizeMemberFullNameParts(fullName as MemberFullNameJson);
  if (!n.first) return 'First name is required.';
  if (!n.last) return 'Last name is required.';
  const parts: [string, string][] = [
    ['First name', n.first],
    ['Middle name', n.middle],
    ['Last name', n.last],
    ['Suffix', n.suffix],
  ];
  for (const [label, v] of parts) {
    if (!v) continue;
    if (v.length > NAME_PART_MAX_LEN) {
      return `${label} must be at most ${NAME_PART_MAX_LEN} characters.`;
    }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)) {
      return `${label} cannot contain control characters.`;
    }
  }
  return null;
}
