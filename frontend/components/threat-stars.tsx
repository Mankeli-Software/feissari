"use client"

import { useEffect, useRef, useState } from 'react'

export function ThreatStars({ level = 0, size = 20, className = '' }: { level?: number; size?: number; className?: string }) {
  const clamped = Math.max(0, Math.min(5, Math.floor(level ?? 0)))
  const [blink, setBlink] = useState(false)
  const prevLevel = useRef<number>(clamped)

  useEffect(() => {
    if (prevLevel.current !== clamped) {
      setBlink(true)
      const t = setTimeout(() => setBlink(false), 700)
      prevLevel.current = clamped
      return () => clearTimeout(t)
    }
  }, [clamped])

  return (
    <span className={`inline-flex items-center gap-1 ${blink ? 'animate-threat-blink' : ''} ${className}`} aria-label={`Threat level ${clamped} out of 5`}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <Star key={idx} filled={idx < clamped} size={size} />
      ))}
    </span>
  )
}

function Star({ filled, size = 20 }: { filled: boolean; size?: number }) {
  const fill = filled ? '#dc2626' /* red-600 */ : '#ffffff'
  const stroke = filled ? '#dc2626' : '#9ca3af' /* gray-400 */
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
      aria-hidden="true"
    >
      <path
        d="M12 2.5l3.09 6.26 6.91 1.01-5 4.87 1.18 6.86L12 18.77l-6.18 3.23L7 14.64l-5-4.87 6.91-1.01L12 2.5z"
        fill={fill}
        stroke={stroke}
        strokeWidth={filled ? 0 : 1}
      />
    </svg>
  )
}

export default ThreatStars
