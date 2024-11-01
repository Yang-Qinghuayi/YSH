import { Obj } from "@/alistTypes"
import { api, encodePath } from "@/util/alistUtils"

type URLType = "preview" | "direct" | "proxy"

export const getLinkByDirAndObj = (
  path: string,
  obj: Obj,
  type: URLType = "proxy",
  encodeAll?: boolean,
) => {

  path = encodePath(path, encodeAll)
  let host = api
  let prefix = type === "direct" ? "/d" : "/p"
  if (type === "preview") {
    prefix = ""
    if (!api.startsWith(location.origin)) host = location.origin
  }
  let ans = `${host}${prefix}${path}`
  if (type !== "preview" && obj.sign) {
    ans += `?sign=${obj.sign}`
  }
  return ans
}

