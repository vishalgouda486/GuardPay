"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useEffect, useState } from "react"
import api from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Users, ShieldAlert, TrendingUp, Activity, Ban } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"


interface Metrics {
  total_registered_users: number
  fraud_attempts_blocked: number
  total_safe_volume_processed: string
  system_trust_average: string
  active_blacklist_entries: number
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [upiId, setUpiId] = useState("")
  const [reason, setReason] = useState("")

  const handleBlockId = async () => {
    if (!upiId || !reason) {
      toast.error("Enter UPI ID and reason")
      return
    }

    try {
      await api.post("/admin/block-id", null, {
        params: {
          upi_id: upiId,
          reason: reason,
        },
      })

      toast.success("UPI ID Blacklisted Successfully")

      setUpiId("")
      setReason("")

      const res = await api.get("/admin/global-stats")
      setMetrics(res.data.metrics)

    } catch (error) {
      toast.error("Failed to blacklist ID")
    }
  }


  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/admin/global-stats")
        setMetrics(res.data.metrics)
      } catch (error) {
        console.error("Failed to fetch admin stats:", error)
      }
    }

    fetchStats()
  }, [])

  if (!metrics) {
    return (
      <div className="text-slate-400">
        Loading Admin Dashboard...
      </div>
    )
  }

  return (
    <div className="space-y-8">

      <div>
        <h2 className="text-3xl font-semibold text-cyan-400">
          GuardPay Command Center
        </h2>
        <p className="text-slate-400 mt-1">
          System-wide fraud analytics & trust metrics
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Users</p>
              <p className="text-2xl font-bold">
                {metrics.total_registered_users}
              </p>
            </div>
            <Users className="text-cyan-400" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Fraud Attempts Blocked</p>
              <p className="text-2xl font-bold">
                {metrics.fraud_attempts_blocked}
              </p>
            </div>
            <ShieldAlert className="text-red-500" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Safe Volume</p>
              <p className="text-2xl font-bold">
                {metrics.total_safe_volume_processed}
              </p>
            </div>
            <TrendingUp className="text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">System Trust Average</p>
              <p className="text-2xl font-bold">
                {metrics.system_trust_average}
              </p>
            </div>
            <Activity className="text-purple-400" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Blacklist Entries</p>
              <p className="text-2xl font-bold">
                {metrics.active_blacklist_entries}
              </p>
            </div>
            <Ban className="text-orange-400" />
          </CardContent>
        </Card>

      </div>
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">
            Transaction Overview
        </h3>

        <ResponsiveContainer width="100%" height={300}>
            <BarChart
            data={[
                {
                    name: "Approved",
                    value: Math.max(
                        metrics.total_registered_users * 2 -
                            metrics.fraud_attempts_blocked,
                        0
                    ),
                },
                {
                    name: "Blocked",
                    value: metrics.fraud_attempts_blocked,
                },
            ]}

            >
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="value" fill="#22c55e" />
            </BarChart>
        </ResponsiveContainer>
    </div>

    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-slate-200">
        Blacklist Control
      </h3>

      <div className="grid md:grid-cols-3 gap-4">
        <Input
          placeholder="Enter UPI ID to block"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
        />

        <Input
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <Button
          className="bg-red-600 hover:bg-red-500"
          onClick={handleBlockId}
        >
          Block ID
        </Button>
      </div>
    </div>


    </div>
  )
}
