export type DriverFullName = {
  first: string
  middle: string
  last: string
  suffix: string
}

export type DriverAddress = {
  province: string
  city: string
  barangay: string
  line: string
}

export type Driver = {
  id: string
  bodyNumber: string
  precinctNumber: string
  fullName: DriverFullName
  birthday: string
  address: DriverAddress
  contactMobile10: string
  tinDigits: string
  profileImageSrc: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_PROFILE_IMAGE = "/default-avatar.png"
