'use client'
/** Real, scannable Code128 barcode — single renderer reused by Sample Receipt
 * and Sample Detail so both show the actual encoded sample_id/barcode instead
 * of decorative bars. Any hardware or camera barcode scanner reads this value
 * back into the Storage / Chain of Custody lookup inputs unchanged. */
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function LiveBarcode({ value, height = 50, width = 1.6 }: {
  value: string
  height?: number
  width?: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        height,
        width,
        displayValue: false,
        margin: 0,
      })
    } catch {
      // Value has characters CODE128 can't encode — leave the SVG empty
      // rather than crash the page.
    }
  }, [value, height, width])

  if (!value) return null
  return <svg ref={svgRef} style={{ width: '100%', height }} />
}
