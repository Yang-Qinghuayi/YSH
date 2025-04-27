export function px2rem(px : number) {
  const ratio = 375 / 10
  return px / ratio
}

export function realPx(px : number) {
  const maxWidth = window.innerWidth > 500 ? 500 : window.innerWidth
  return px * (maxWidth / 375)
}
