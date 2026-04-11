const PSGC_API_BASE = "https://psgc.cloud/api"

export interface PsgcRegion {
  code: string
  name: string
  regionName: string
}

export interface PsgcProvince {
  code: string
  name: string
  regionCode: string
}

export interface PsgcCity {
  code: string
  name: string
  provinceCode: string
  isCity: boolean
  isMunicipality: boolean
}

export interface PsgcBarangay {
  code: string
  name: string
  cityCode: string
}

export async function fetchRegions(): Promise<PsgcRegion[]> {
  const res = await fetch(`${PSGC_API_BASE}/regions`)
  if (!res.ok) throw new Error("Failed to fetch regions")
  return res.json()
}

export async function fetchProvinces(regionCode?: string): Promise<PsgcProvince[]> {
  const url = regionCode 
    ? `${PSGC_API_BASE}/regions/${regionCode}/provinces`
    : `${PSGC_API_BASE}/provinces`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch provinces")
  return res.json()
}

export async function fetchCities(provinceCode: string): Promise<PsgcCity[]> {
  const res = await fetch(`${PSGC_API_BASE}/provinces/${provinceCode}/cities-municipalities`)
  if (!res.ok) throw new Error("Failed to fetch cities")
  return res.json()
}

export async function fetchBarangays(cityCode: string): Promise<PsgcBarangay[]> {
  const res = await fetch(`${PSGC_API_BASE}/cities-municipalities/${cityCode}/barangays`)
  if (!res.ok) throw new Error("Failed to fetch barangays")
  return res.json()
}
