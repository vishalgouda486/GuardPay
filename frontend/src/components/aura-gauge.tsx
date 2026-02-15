"use client"

import { motion } from "framer-motion"

interface AuraGaugeProps {
  value: number
}

export default function AuraGauge({ value }: AuraGaugeProps) {
  const radius = 70
  const stroke = 12
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset =
    circumference - (value / 100) * circumference

  const getColor = () => {
    if (value > 90) return "#7c3aed"   // Elite - Clean Purple
    if (value > 60) return "#22c55e"   // Standard - Clean Green
    return "#ef4444"                   // High Risk - Red
  }

  const color = getColor()

  return (
    <div className="relative flex items-center justify-center">

      <svg height={radius * 2} width={radius * 2}>
        {/* Background circle */}
        <circle
          stroke="#1e293b"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />

        {/* Animated progress circle */}
        <motion.circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          strokeDasharray={circumference + " " + circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8 }}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            filter: "drop-shadow(0 0 2px #01fb54)", // this is the glow function
          }}
        />
      </svg>

      {/* Static center value */}
      <div
        className="absolute text-3xl font-semibold"
        style={{ color }}
      >
        {value}%
      </div>
    </div>
  )
}
