"use client"

import AuraGauge from "@/components/aura-gauge"
import { useEffect, useState } from "react"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react"

export default function DashboardPage() {
  const [auraScore, setAuraScore] = useState<number>(0)
  const [username, setUsername] = useState<string | null>(null)


  useEffect(() => {
  const storedUser = localStorage.getItem("guardpay_user")

  if (!storedUser) {
    window.location.href = "/auth/login"
    return
  }

  setUsername(storedUser)

  const loadProfile = async () => {
    const storedAura = localStorage.getItem("guardpay_aura")

    if (storedAura) {
      setAuraScore(Number(storedAura))
    } else {
      try {
        const res = await api.get(`/user/profile/${storedUser}`)
        setAuraScore(res.data.trust_rating.aura_score)
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      }
    }
  }

  loadProfile()
}, [])


  const getStatus = () => {
    if (auraScore > 90) return "Elite"
    if (auraScore > 60) return "Standard"
    return "High Risk"
  }

  return (
    <div className="space-y-8">
      
      <div>
        <h2 className="text-3xl font-semibold text-cyan-400">
          Security Dashboard
        </h2>
        <p className="text-slate-400 mt-1">
          Real-time trust & transaction monitoring
        </p>
      </div>

      <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-cyan-400" />
            Trust Aura Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <AuraGauge value={auraScore} />
          </div>


          <Badge
            className={`${
              auraScore > 90
                ? "bg-purple-600"
                : auraScore > 60
                ? "bg-emerald-600"
                : "bg-red-600"
            }`}
          >
            {getStatus()}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Live Monitoring</p>
              <p className="text-2xl font-bold">Active</p>
            </div>
            <TrendingUp className="text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Fraud Shield</p>
              <p className="text-2xl font-bold">Enabled</p>
            </div>
            <AlertTriangle className="text-red-500" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Risk Engine</p>
              <p className="text-2xl font-bold">Operational</p>
            </div>
            <ShieldCheck className="text-cyan-400" />
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
