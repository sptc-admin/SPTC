"use client"

import * as React from "react"
import "react-easy-crop/react-easy-crop.css"
import Cropper, { type Area, type Point } from "react-easy-crop"
import { generateReactHelpers } from "@uploadthing/react"
import { Loader2, Upload } from "lucide-react"

import type { OurFileRouter } from "@/app/api/uploadthing/core"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const { useUploadThing } = generateReactHelpers<OurFileRouter>()

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"
const MAX_BYTES = 4 * 1024 * 1024
const CROP_EXPORT_SIZE = 512

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener("load", () => resolve(img))
    img.addEventListener("error", () =>
      reject(new Error("Could not load image"))
    )
    img.src = url
  })
}

async function circularCropToBlob(
  imageSrc: string,
  pixelCrop: Area,
  size: number
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not create image")

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not export image")),
      "image/jpeg",
      0.92
    )
  })
}

type MemberAvatarUploadProps = {
  onUploaded: (url: string) => void
  onToastError: (message: string) => void
}

export function MemberAvatarUpload({
  onUploaded,
  onToastError,
}: MemberAvatarUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const objectUrlRef = React.useRef<string | null>(null)
  const [cropOpen, setCropOpen] = React.useState(false)
  const [imageSrc, setImageSrc] = React.useState<string | null>(null)
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] =
    React.useState<Area | null>(null)

  const resetCropState = React.useCallback(() => {
    setCropOpen(false)
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setImageSrc(null)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
    setCroppedAreaPixels(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const { startUpload, isUploading } = useUploadThing("memberAvatar", {
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
      resetCropState()
    },
    onUploadError(error) {
      onToastError(error.message || "Upload failed")
      resetCropState()
    },
  })

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      onToastError("Choose an image file.")
      return
    }
    if (file.size > MAX_BYTES) {
      onToastError("Image must be 4MB or smaller.")
      return
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setImageSrc(url)
    setCropOpen(true)
  }

  async function applyCrop() {
    if (!imageSrc || !croppedAreaPixels) {
      onToastError("Adjust the crop first.")
      return
    }
    try {
      const blob = await circularCropToBlob(
        imageSrc,
        croppedAreaPixels,
        CROP_EXPORT_SIZE
      )
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" })
      await startUpload([file])
    } catch (err) {
      onToastError(
        err instanceof Error ? err.message : "Could not process image"
      )
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
            Uploading…
          </>
        ) : (
          <>
            <Upload className="size-4" aria-hidden />
            Upload photo
          </>
        )}
      </Button>

      {cropOpen && imageSrc ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-crop-title"
        >
          <button
            type="button"
            className={cn(
              "absolute inset-0 cursor-pointer bg-black/60",
              isUploading && "pointer-events-none"
            )}
            aria-label="Close cropper"
            disabled={isUploading}
            onClick={() => resetCropState()}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl">
            <h2 id="avatar-crop-title" className="mb-3 text-sm font-semibold">
              Crop to circle
            </h2>
            <div className="relative h-[280px] w-full overflow-hidden rounded-lg bg-neutral-100">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, area) => setCroppedAreaPixels(area)}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
              <span className="shrink-0">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
                disabled={isUploading}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => resetCropState()}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-black text-white hover:bg-black/90"
                onClick={() => void applyCrop()}
                disabled={isUploading || !croppedAreaPixels}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Uploading…
                  </>
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
