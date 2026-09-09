'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Code2 } from 'lucide-react'

// Fallback icon when image fails to load

interface LogoProps {
  src: string
  alt: string
  size?: number
  showFallback?: boolean
}

export function Logo({ src, alt, size = 64, showFallback = true }: LogoProps) {
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    if (showFallback) {
      setHasError(true)
    }
  }

  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 backdrop-blur-md shadow-md border border-sky-200/60 overflow-hidden p-2">
      {!hasError ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          onError={handleError}
        />
      ) : (
        <Code2 className="text-3xl font-black text-blue-600" />
      )}
    </div>
  )
}
