function padBase64url(s: string): string {
  const m = s.length % 4
  return m === 0 ? s : s + "=".repeat(4 - m)
}

function parseJsonPayload(b64urlPart: string): { apiKey?: string } {
  const b64 = padBase64url(b64urlPart.replace(/-/g, "+").replace(/_/g, "/"))
  const json = Buffer.from(b64, "base64").toString("utf8")
  return JSON.parse(json) as { apiKey?: string }
}

function decodeUploadThingTokenPayload(raw: string): { apiKey?: string } {
  const token = raw.trim().replace(/^["']|["']$/g, "")

  const jwtParts = token.split(".")
  if (jwtParts.length === 3) {
    try {
      const parsed = parseJsonPayload(jwtParts[1])
      if (parsed.apiKey) return parsed
    } catch {}
  }

  if (!token.includes(".")) {
    try {
      const parsed = parseJsonPayload(token)
      if (parsed.apiKey) return parsed
    } catch {}
  }

  throw new Error(
    "UPLOADTHING_TOKEN is invalid — paste the full V7 token from UploadThing Dashboard → API Keys (V7 tab)"
  )
}

export function assertUploadThingEnv(): void {
  const token = process.env.UPLOADTHING_TOKEN
  const secret = process.env.SECRET_KEY

  if (token === undefined || token === "") {
    throw new Error("UPLOADTHING_TOKEN is required")
  }
  if (secret === undefined || secret === "") {
    throw new Error("SECRET_KEY is required")
  }

  const payload = decodeUploadThingTokenPayload(token)
  if (payload.apiKey !== secret) {
    throw new Error("SECRET_KEY must match apiKey embedded in UPLOADTHING_TOKEN")
  }
}
