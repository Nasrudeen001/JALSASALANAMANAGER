"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface QRScannerProps {
  onScanSuccess: (memberId: string) => void
  onClose: () => void
  title?: string
}

export function QRScanner({ onScanSuccess, onClose, title = "Scan QR Code" }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isMountedRef = useRef(true)
  const onScanSuccessRef = useRef(onScanSuccess)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Use a unique ID for each scanner instance to avoid conflicts
  const scannerIdRef = useRef(`qr-reader-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  // Update the ref when onScanSuccess changes
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess
  }, [onScanSuccess])

  useEffect(() => {
    isMountedRef.current = true
    const scannerId = scannerIdRef.current
    
    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          // Check if scanner is running before trying to stop
          const state = scannerRef.current.getState()
          if (state === 2) { // STATE_RUNNING = 2
            await scannerRef.current.stop()
          }
          
          // Check if the DOM element still exists before clearing
          const element = document.getElementById(scannerId)
          if (element && element.parentNode) {
            try {
              scannerRef.current.clear()
            } catch (clearErr: any) {
              // Ignore clear errors (element might already be removed by React)
              if (!clearErr.message?.includes("removeChild")) {
                console.warn("Error clearing scanner:", clearErr)
              }
            }
          }
          // Additionally, make sure any underlying MediaStream tracks are stopped so
          // the camera is fully released for other apps/devices.
          try {
            const el = document.getElementById(scannerId)
            if (el) {
              // find any video elements inside the scanner container
              const videos = el.getElementsByTagName("video")
              for (let i = 0; i < videos.length; i++) {
                const video = videos[i] as HTMLVideoElement
                const media = (video.srcObject) as MediaStream | null
                if (media && media.getTracks) {
                  media.getTracks().forEach((t) => {
                    try { t.stop() } catch (e) { /* ignore */ }
                  })
                  try {
                    video.srcObject = null
                  } catch (e) { /* ignore */ }
                }
              }
            }
          } catch (trackErr) {
            // Non-critical: if we can't stop tracks, keep going but log for debugging
            console.warn("Error stopping media tracks:", trackErr)
          }
        } catch (err: any) {
          // Ignore "scanner is not running" errors
          if (err && !err.message?.includes("not running") && !err.message?.includes("not started") && !err.message?.includes("removeChild")) {
            console.error("Error stopping scanner:", err)
          }
        } finally {
          scannerRef.current = null
          if (isMountedRef.current) {
            setIsScanning(false)
          }
        }
      }
    }
    
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId)
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: "environment" }, // Use back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            // Successfully scanned
            if (isMountedRef.current) {
              await stopScanner()
              onScanSuccessRef.current(decodedText)
            }
          },
          (errorMessage) => {
            // Ignore scanning errors (they're frequent during scanning)
          }
        )

        if (isMountedRef.current) {
          setIsScanning(true)
          setError(null)
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          console.error("Error starting QR scanner:", err)
          setError(err.message || "Failed to start camera")
          setIsScanning(false)
        }
      }
    }

    startScanner()

    return () => {
      isMountedRef.current = false
      // Cleanup: stop scanner if it's running
      if (scannerRef.current) {
        stopScanner().catch(() => {
          // Silently handle any cleanup errors
        })
      }
    }
  }, []) // Empty dependency array - only run once on mount

  const handleClose = async () => {
    // Stop scanner before closing
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2) { // STATE_RUNNING = 2
          await scannerRef.current.stop()
        }
        
        // Check if the DOM element still exists before clearing
        const element = document.getElementById(scannerIdRef.current)
        if (element && element.parentNode) {
          try {
            scannerRef.current.clear()
          } catch (clearErr: any) {
            // Ignore clear errors (element might already be removed by React)
            if (!clearErr.message?.includes("removeChild")) {
              console.warn("Error clearing scanner:", clearErr)
            }
          }
        }
        // Also stop any underlying MediaStream tracks to ensure camera is released
        try {
          const el = document.getElementById(scannerIdRef.current)
          if (el) {
            const videos = el.getElementsByTagName("video")
            for (let i = 0; i < videos.length; i++) {
              const video = videos[i] as HTMLVideoElement
              const media = (video.srcObject) as MediaStream | null
              if (media && media.getTracks) {
                media.getTracks().forEach((t) => {
                  try { t.stop() } catch (e) { /* ignore */ }
                })
                try { video.srcObject = null } catch (e) { /* ignore */ }
              }
            }
          }
        } catch (trackErr) {
          console.warn("Error stopping media tracks on close:", trackErr)
        }
      } catch (err: any) {
        // Ignore "scanner is not running" errors and removeChild errors
        if (err && !err.message?.includes("not running") && !err.message?.includes("not started") && !err.message?.includes("removeChild")) {
          console.error("Error stopping scanner:", err)
        }
      } finally {
        scannerRef.current = null
        setIsScanning(false)
      }
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">{title}</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative">
          <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-800">
            {/* Professional scanner frame overlay */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Corner brackets with glow effect */}
              <div className="absolute top-0 left-0 w-16 h-16">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-green-400 rounded-tl-lg shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                <div className="absolute top-1 left-1 w-10 h-10 border-t-2 border-l-2 border-green-300/50 rounded-tl-lg" />
              </div>
              <div className="absolute top-0 right-0 w-16 h-16">
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-green-400 rounded-tr-lg shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                <div className="absolute top-1 right-1 w-10 h-10 border-t-2 border-r-2 border-green-300/50 rounded-tr-lg" />
              </div>
              <div className="absolute bottom-0 left-0 w-16 h-16">
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-green-400 rounded-bl-lg shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                <div className="absolute bottom-1 left-1 w-10 h-10 border-b-2 border-l-2 border-green-300/50 rounded-bl-lg" />
              </div>
              <div className="absolute bottom-0 right-0 w-16 h-16">
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-green-400 rounded-br-lg shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                <div className="absolute bottom-1 right-1 w-10 h-10 border-b-2 border-r-2 border-green-300/50 rounded-br-lg" />
              </div>
              
              {/* Scanning line animation */}
              {isScanning && (
                <>
                  <style>{`
                    @keyframes scanLine {
                      0% {
                        top: 0%;
                        opacity: 1;
                      }
                      50% {
                        opacity: 1;
                      }
                      100% {
                        top: 100%;
                        opacity: 0;
                      }
                    }
                    .scan-line {
                      animation: scanLine 2s linear infinite;
                    }
                  `}</style>
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-b from-transparent via-green-400 to-transparent shadow-[0_0_20px_rgba(34,197,94,0.9)] scan-line" />
                </>
              )}
              
              {/* Center guide lines (subtle) */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-green-500/20" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-500/20" />
            </div>
            
            {/* Scanner video container */}
            <div id={scannerIdRef.current} className="w-full h-full" />
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          {!isScanning && !error && (
            <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded text-blue-700 text-sm">
              Starting camera...
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Position the QR code within the frame to scan
          </p>
        </div>
      </div>
    </div>
  )
}

