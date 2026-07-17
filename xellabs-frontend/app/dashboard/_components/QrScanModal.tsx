'use client'
/**
 * Shared camera QR scanner used anywhere a location/sample label needs to be
 * captured via device camera. Extracted from StorageLocationInput so the
 * Storage page's own scan bar can reuse the exact same decode logic — one
 * camera implementation instead of two.
 */
import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function QrScanModal({ title = 'Scan Barcode / QR', hint, onClose, onDecode }: {
  title?: string
  hint?: string
  onClose: () => void
  onDecode: (code: string) => Promise<boolean>
}) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const [camError, setCamError] = useState('')
  const [scanMsg, setScanMsg]   = useState('')
  const busyRef   = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let cancelled = false
    const canvas = document.createElement('canvas')

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('Camera not available. It requires HTTPS (or localhost) and a device camera.')
        return
      }
      try {
        // Prefer the rear camera (phones); fall back to any camera (desktop webcams)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        }
      } catch (e) {
        const name = (e as DOMException)?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setCamError('Camera permission was blocked. Click the camera icon in the address bar (or the shields/lock icon) and allow camera access for this site, then reopen the scanner. On Windows also check Settings → Privacy & Security → Camera.')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setCamError('No camera was found on this device. Use a device with a camera, or type / wedge-scan the code into the field instead.')
        } else if (name === 'NotReadableError') {
          setCamError('The camera is in use by another application. Close it and try again.')
        } else {
          setCamError('Camera unavailable. You can type or wedge-scan the code into the field instead.')
        }
        return
      }
      if (cancelled || !videoRef.current) { stream?.getTracks().forEach(t => t.stop()); return }
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => {})
      tick()
    }

    function tick() {
      if (cancelled) return
      const video = videoRef.current
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
          if (qr?.data) {
            busyRef.current = true
            setScanMsg(`Found ${qr.data} — checking…`)
            onDecode(qr.data.trim()).then(ok => {
              busyRef.current = false
              if (!ok) setScanMsg('')
            })
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onDecode])

  return (
    <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 100, backgroundColor: 'rgba(17,24,39,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bg-white rounded-xl" style={{ width: 380, maxWidth: '92vw', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2">
            <MI name="qr_code_scanner" size={16} color="#2563EB" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <MI name="close" size={18} color="#6B7280" />
          </button>
        </div>
        <div style={{ padding: 14 }}>
          {camError ? (
            <div style={{ fontSize: 12, color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px' }}>
              {camError}
            </div>
          ) : (
            <>
              <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 10, backgroundColor: '#111827', aspectRatio: '4 / 3', objectFit: 'cover' }} />
              <p style={{ fontSize: 11, color: scanMsg ? '#2563EB' : '#6B7280', textAlign: 'center', marginTop: 8 }}>
                {scanMsg || hint || 'Point the camera at a barcode or QR label.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
