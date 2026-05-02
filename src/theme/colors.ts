export const teal = {
  50: '#E1F5EE',
  100: '#9FE1CB',
  400: '#1D9E75',
  600: '#0F6E56',
  800: '#085041',
} as const

export const coral = {
  50: '#FAECE7',
  400: '#D85A30',
  600: '#993C1D',
  800: '#712B13',
} as const

export const purple = {
  50: '#EEEDFE',
  400: '#7F77DD',
  600: '#534AB7',
  800: '#3C3489',
} as const

export const amber = {
  50: '#FAEEDA',
  400: '#EF9F27',
  600: '#BA7517',
  800: '#633806',
} as const

export const blue = {
  50: '#E6F1FB',
  400: '#378ADD',
  600: '#185FA5',
  800: '#0C447C',
} as const

export const colors = { teal, coral, purple, amber, blue } as const

export type ColorKey = keyof typeof colors
export type ColorShade = '50' | '100' | '400' | '600' | '800'
export type ColorScale = typeof teal | typeof coral | typeof purple | typeof amber | typeof blue

/** Returns the appropriate status color hex based on a completion rate (0–1). */
export function statusColor(rate: number): string {
  if (rate >= 0.7) return teal[400]
  if (rate >= 0.4) return amber[400]
  return coral[400]
}

/** Returns the background color for a status rate. */
export function statusBgColor(rate: number): string {
  if (rate >= 0.7) return teal[50]
  if (rate >= 0.4) return amber[50]
  return coral[50]
}

/** Returns the text color for a status rate. */
export function statusTextColor(rate: number): string {
  if (rate >= 0.7) return teal[800]
  if (rate >= 0.4) return amber[800]
  return coral[800]
}
