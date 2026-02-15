"use client"

import RiskGauge from "@/components/risk-gauge"
import { useState } from "react"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ShieldAlert, ShieldCheck } from "lucide-react"

export default function TransferPage() {
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [riskScore, setRiskScore] = useState<number | null>(null)
  const [threshold, setThreshold] = useState<number | null>(null)
  const [riskFactors, setRiskFactors] = useState<string[]>([])
  const [status, setStatus] = useState<string | null>(null)

  const handleTransfer = async () => {
    const username = localStorage.getItem("guardpay_user")

    if (!username) {
      toast.error("Not authenticated")
      return
    }

    try {
      setLoading(true)

      const res = await api.post("/safe-transfer", {
        sender_username: username,
        recipient_upi: recipient,
        amount: parseFloat(amount),
        idempotency_key: crypto.randomUUID(),
      })

      setRiskScore(res.data.risk_score)
      setThreshold(res.data.applied_threshold)
      setRiskFactors(res.data.risk_factors || [])
      setStatus(res.data.status)
      if (res.data.current_aura !== undefined) {
        localStorage.setItem("guardpay_aura", res.data.current_aura)
      }


      if (res.data.status === "SUCCESS") {
        toast.success("Transaction Approved ✅")
      } else {
        toast.error("Transaction Denied ❌")
      }
    } catch (err) {
      toast.error("Transfer failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">

      <div>
        <h2 className="text-3xl font-semibold text-cyan-400">
          Smart Risk Transfer
        </h2>
        <p className="text-slate-400 mt-1">
          AI-powered fraud detection & trust evaluation
        </p>
      </div>

      <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Initiate Secure Transfer</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Recipient UPI"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-500"
            onClick={handleTransfer}
            disabled={loading}
          >
            {loading ? "Analyzing Risk..." : "Send Securely"}
          </Button>
        </CardContent>
      </Card>

      {riskScore !== null && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {status === "SUCCESS" ? (
                <ShieldCheck className="text-emerald-500" />
              ) : (
                <ShieldAlert className="text-red-500" />
              )}
              Risk Evaluation Result
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            <div className="flex flex-col items-center">
              <p className="text-sm text-slate-400 mb-2">Risk Score</p>
              <RiskGauge value={riskScore} />
            </div>


            <div>
              <p className="text-sm text-slate-400">Applied Threshold</p>
              <div className="text-lg">{threshold}</div>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">
                Risk Factors Triggered
              </p>

              <div className="flex flex-wrap gap-2">
                {riskFactors.length > 0 ? (
                  riskFactors.map((factor, index) => (
                    <Badge key={index} className="bg-slate-800">
                      {factor}
                    </Badge>
                  ))
                ) : (
                  <Badge className="bg-emerald-700">
                    No Risk Flags
                  </Badge>
                )}
              </div>
            </div>

            <Badge
              className={`${
                status === "SUCCESS"
                  ? "bg-emerald-600"
                  : "bg-red-600"
              }`}
            >
              {status}
            </Badge>

          </CardContent>
        </Card>
      )}

    </div>
  )
}
