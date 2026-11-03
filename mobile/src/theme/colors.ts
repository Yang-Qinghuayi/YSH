import { argbFromHex, Hct, hexFromArgb, SchemeTonalSpot } from '@material/material-color-utilities';
import { normalizeSeed, DEFAULT_SETTINGS } from '../domain/models';

/** One canonical Material role table; adapters never calculate a second palette. */
export function createColors(seed: string, dark: boolean) {
  const s = new SchemeTonalSpot(
    Hct.fromInt(argbFromHex(normalizeSeed(seed) ?? DEFAULT_SETTINGS.seed)),
    dark,
    0
  );
  const hex = hexFromArgb;
  return {
    primary: hex(s.primary),
    onPrimary: hex(s.onPrimary),
    primaryContainer: hex(s.primaryContainer),
    onPrimaryContainer: hex(s.onPrimaryContainer),
    secondary: hex(s.secondary),
    onSecondary: hex(s.onSecondary),
    secondaryContainer: hex(s.secondaryContainer),
    onSecondaryContainer: hex(s.onSecondaryContainer),
    tertiary: hex(s.tertiary),
    onTertiary: hex(s.onTertiary),
    tertiaryContainer: hex(s.tertiaryContainer),
    onTertiaryContainer: hex(s.onTertiaryContainer),
    error: hex(s.error),
    onError: hex(s.onError),
    errorContainer: hex(s.errorContainer),
    onErrorContainer: hex(s.onErrorContainer),
    surface: hex(s.surface),
    onSurface: hex(s.onSurface),
    surfaceVariant: hex(s.surfaceVariant),
    onSurfaceVariant: hex(s.onSurfaceVariant),
    surfaceContainer: hex(s.surfaceContainer),
    surfaceContainerLow: hex(s.surfaceContainerLow),
    surfaceContainerHigh: hex(s.surfaceContainerHigh),
    background: hex(s.background),
    onBackground: hex(s.onSurface),
    outline: hex(s.outline),
    outlineVariant: hex(s.outlineVariant),
    inverseSurface: hex(s.inverseSurface),
    inverseOnSurface: hex(s.inverseOnSurface),
    inversePrimary: hex(s.inversePrimary),
    shadow: hex(s.shadow),
    scrim: hex(s.scrim),
  };
}
export type Colors = ReturnType<typeof createColors>;
export function withAlpha(color: string, alpha: number) {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
export function nativeVariables(colors: Colors): Record<`--${string}`, string> {
  return Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [
      `--app-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`,
      value,
    ])
  );
}
