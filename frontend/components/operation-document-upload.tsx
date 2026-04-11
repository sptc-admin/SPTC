"use client"

import * as React from "react"
import { generateReactHelpers } from "@uploadthing/react"
import { Loader2, Upload } from "lucide-react"

import type { OurFileRouter } from "@/app/api/uploadthing/core"
import { Button } from "@/components/ui/button"

const { useUploadThing } = generateReactHelpers<OurFileRouter>()

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif"
const MAX_BYTES = 8 * 1024 * 1024

type OperationDocumentUploadProps = {
  label: string
  onUploaded: (url: string) => void
  onToastError: (message: string) => void
}

export function OperationDocumentUpload({
  label,
  onUploaded,
  onToastError,
}: OperationDocumentUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const { startUpload, isUploading } = useUploadThing("operationsDocument", {
    onClientUploadComplete(res) {
      const first = res[0]
      const fromServer =
        first?.serverData &&
        typeof first.serverData === "object" &&
        "url" in first.serverData
          ? String((first.serverData as { url?: string }).url ?? "")
          : ""
      const fromDirect = first?.url ? String(first.url) : ""
      const url = fromServer || fromDirect
      if (url) onUploaded(url)
      if (inputRef.current) inputRef.current.value = ""
    },
    onUploadError(error) {
      onToastError(error.message || "Upload failed")
      if (inputRef.current) inputRef.current.value = ""
    },
  })

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      onToastError("File must be 8MB or smaller.")
      return
    }
    try {
      await startUpload([file])
    } catch {
      onToastError("Upload failed")
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        type="button"
        className="gap-2 bg-black text-white hover:bg-black/90"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="size-4" aria-hidden />
            {label}
          </>
        )}
      </Button>
    </>
  )
}
