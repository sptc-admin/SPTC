export function getPublicApiUrl(): string {
  const v = process.env.NEXT_PUBLIC_API_URL
  if (v === undefined || v === "") {
    throw new Error("NEXT_PUBLIC_API_URL is required")
  }
  return v
}
