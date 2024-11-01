
// @ts-ignore
export let api = import.meta.env.VITE_ALIST_APB as string

export const encodePath = (path: string, all?: boolean) => {
    return path
      .split("/")
      .map((p) =>
        all
          ? encodeURIComponent(p)
          : p
              .replace(/%/g, "%25")
              .replace(/\?/g, "%3F")
              .replace(/#/g, "%23")
              .replace(/ /g, "%20"),
      )
      .join("/")
  }
