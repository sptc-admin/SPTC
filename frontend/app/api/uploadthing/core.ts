import { createUploadthing, type FileRouter } from "uploadthing/next"

const f = createUploadthing()

export const ourFileRouter = {
  memberAvatar: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => {
      const url =
        "ufsUrl" in file && typeof file.ufsUrl === "string"
          ? file.ufsUrl
          : "url" in file && typeof file.url === "string"
            ? file.url
            : ""
      return { url }
    }),
  operationsDocument: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
    pdf: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => {
      const url =
        "ufsUrl" in file && typeof file.ufsUrl === "string"
          ? file.ufsUrl
          : "url" in file && typeof file.url === "string"
            ? file.url
            : ""
      return { url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
