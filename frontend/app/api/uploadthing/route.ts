import { assertUploadThingEnv } from "@/lib/uploadthing-assert-env"
import { createRouteHandler } from "uploadthing/next"

import { ourFileRouter } from "./core"

assertUploadThingEnv()

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
