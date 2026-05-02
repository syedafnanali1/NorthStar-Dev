'use client'

import { useState, useEffect } from 'react'

export const MODAL_MAX_WIDTH = 400
export const ICON_CIRCLE_SM = 34
export const ICON_CIRCLE_LG = 44

/** Returns the modal width clamped to MODAL_MAX_WIDTH, leaving 16px margin on each side. */
export function getModalWidth(viewportWidth: number): number {
  return Math.min(viewportWidth - 32, MODAL_MAX_WIDTH)
}

/**
 * Returns 0.9 for viewports narrower than 360px (small phones), 1.0 otherwise.
 * Multiply all font sizes by this value when rendering on very small screens.
 */
export function getFontScale(viewportWidth: number): number {
  return viewportWidth < 360 ? 0.9 : 1.0
}

/** Hook: returns the current modal width, updates on window resize. */
export function useModalWidth(): number {
  const [width, setWidth] = useState<number>(MODAL_MAX_WIDTH)

  useEffect(() => {
    function update() {
      setWidth(getModalWidth(window.innerWidth))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return width
}

/** Hook: returns true when the viewport is narrower than 640px (mobile). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    function update() {
      setIsMobile(window.innerWidth < 640)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return isMobile
}

/** Hook: returns the current font scale factor. */
export function useFontScale(): number {
  const [scale, setScale] = useState<number>(1.0)

  useEffect(() => {
    function update() {
      setScale(getFontScale(window.innerWidth))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return scale
}
