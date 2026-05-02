import type { CSSProperties } from 'react'

export const layout = {
  modal: {
    borderRadiusTop: 20,
    borderRadiusBottom: 16,
  },
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
  },
  button: {
    borderRadius: 10,
    minHeight: 44,
  },
  iconCircle: {
    sm: 34,
    lg: 44,
  },
  typography: {
    title: 18,
    bodyBold: 14,
    bodyRegular: 13,
    secondary: 12,
    tertiary: 11,
  },
  icon: {
    sm: 18,
    md: 20,
    lg: 22,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
} as const

/** Returns inline style for a standard card container. */
export function cardStyle(overrides?: CSSProperties): CSSProperties {
  return {
    borderRadius: layout.card.borderRadius,
    borderWidth: layout.card.borderWidth,
    borderStyle: 'solid',
    padding: layout.card.padding,
    ...overrides,
  }
}

/** Returns inline style for a bottom sheet modal container. */
export function modalStyle(overrides?: CSSProperties): CSSProperties {
  return {
    borderTopLeftRadius: layout.modal.borderRadiusTop,
    borderTopRightRadius: layout.modal.borderRadiusTop,
    borderBottomLeftRadius: layout.modal.borderRadiusBottom,
    borderBottomRightRadius: layout.modal.borderRadiusBottom,
    ...overrides,
  }
}

/** Returns inline style for a primary button. */
export function buttonStyle(backgroundColor: string, overrides?: CSSProperties): CSSProperties {
  return {
    minHeight: layout.button.minHeight,
    borderRadius: layout.button.borderRadius,
    backgroundColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    fontSize: layout.typography.bodyRegular,
    color: '#ffffff',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    ...overrides,
  }
}

/** Returns inline style for a ghost button. */
export function ghostButtonStyle(overrides?: CSSProperties): CSSProperties {
  return {
    minHeight: layout.button.minHeight,
    borderRadius: layout.button.borderRadius,
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    fontSize: layout.typography.bodyRegular,
    width: '100%',
    cursor: 'pointer',
    ...overrides,
  }
}
