import type { FocusEvent } from 'react'

/** Select full value on focus so a new measurement can be typed immediately. */
export function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select()
}
