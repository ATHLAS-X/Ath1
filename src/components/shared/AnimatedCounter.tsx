'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

interface AnimatedCounterProps {
  to: number
  duration?: number
}

export default function AnimatedCounter({ to, duration = 1 }: AnimatedCounterProps) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const controls = animate(fromRef.current, to, {
      duration,
      ease: 'easeOut',
      onUpdate: latest => setValue(Math.round(latest)),
    })
    fromRef.current = to
    return () => controls.stop()
  }, [to, duration])

  return <>{value.toLocaleString('en-IN')}</>
}
