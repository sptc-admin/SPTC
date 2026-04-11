export type MemberFullName = {
  first: string
  middle: string
  last: string
  suffix: string
}

export type MemberAddress = {
  province: string
  city: string
  barangay: string
  line: string
}

export type MemberFinancials = {
  loan: number
  savings: number
  arkilahan: number
  butawHulog: number
  lipatan: number
  shareCapital: number
}

export type LipatanHistoryEntry = {
  transferredAt: string
  fromOperatorName?: string
  toOperatorName?: string
  shareCapitalDeducted: number
  documentUrl?: string
  previousPersonal: {
    fullName: MemberFullName
    birthday: string
    address: MemberAddress
    contactMobile10: string
    tinDigits: string
    precinctNumber?: string
  }
  /** Legacy lipatan records */
  deductedFromMemberName?: string
}

export type Member = {
  id: string
  bodyNumber: string
  precinctNumber: string
  fullName: MemberFullName
  birthday: string
  address: MemberAddress
  contactMobile10: string
  tinDigits: string
  profileImageSrc: string
  financials: MemberFinancials
  lipatanHistory?: LipatanHistoryEntry[]
  createdAt?: string
  updatedAt?: string
}

export const STATIC_MEMBER_FINANCIALS: MemberFinancials = {
  loan: 0,
  savings: 0,
  arkilahan: 0,
  butawHulog: 0,
  lipatan: 0,
  shareCapital: 0,
}

export const DEFAULT_PROFILE_IMAGE = "/member-placeholder.svg"
