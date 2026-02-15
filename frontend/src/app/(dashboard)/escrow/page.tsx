"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Escrow {
  escrow_id: string
  sender_id: string
  receiver_id: string
  amount: number
  status: string
}

export default function EscrowPage() {
  const username =
    typeof window !== "undefined"
      ? localStorage.getItem("guardpay_user")
      : null

  const [sentEscrows, setSentEscrows] = useState<Escrow[]>([])
  const [incomingEscrows, setIncomingEscrows] = useState<Escrow[]>([])

  const [receiver, setReceiver] = useState("")
  const [amount, setAmount] = useState("")

  const fetchEscrows = async () => {
    try {
      const sent = await api.get(`/my-sent-escrows/${username}`)
      const incoming = await api.get(`/my-incoming-escrows/${username}`)

      setSentEscrows(sent.data.escrows)
      setIncomingEscrows(incoming.data.escrows)
    } catch (error) {
      console.error("Failed to fetch escrows:", error)
    }
  }

  useEffect(() => {
    if (username) fetchEscrows()
  }, [])

  // Create Escrow
  const handleCreateEscrow = async () => {
    if (!receiver || !amount) {
      toast.error("All fields required")
      return
    }

    try {
      const res = await api.post("/create-escrow-payment", {
        sender_id: username,
        receiver_id: receiver,
        amount: Number(amount),
      })

      if (res.data.status === "ESCROW_LOCKED") {
        toast.success("Escrow Locked Successfully")
        setReceiver("")
        setAmount("")
        fetchEscrows()
      }
    } catch (error) {
      toast.error("Failed to create escrow")
    }
  }

  // Release Escrow
  const handleRelease = async (escrowId: string) => {
    try {
      const res = await api.post(
        `/release-escrow?escrow_id=${escrowId}`
      )

      if (res.data.status === "SUCCESS") {
        toast.success("Funds Released")
        fetchEscrows()
      }
    } catch (error) {
      toast.error("Failed to release funds")
    }
  }

  // Refund Escrow
  const handleRefund = async (escrowId: string) => {
    try {
      const res = await api.post(
        `/request-escrow-refund?escrow_id=${escrowId}&username=${username}`
      )

      if (res.data.status === "SUCCESS") {
        toast.success("Refund Processed")
        fetchEscrows()
      }
    } catch (error) {
      toast.error("Refund failed")
    }
  }

  const statusColor = (status: string) => {
    if (status === "LOCKED") return "bg-yellow-500"
    if (status === "RELEASED") return "bg-emerald-600"
    if (status === "REFUNDED") return "bg-red-600"
    return "bg-gray-500"
  }

  return (
    <div className="space-y-8">

      <div>
        <h2 className="text-3xl font-semibold text-cyan-400">
          Escrow Payments
        </h2>
        <p className="text-slate-400 mt-1">
          Secure transaction holding system
        </p>
      </div>

      {/* Create Escrow */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            Create Escrow Payment
          </h3>

          <Input
            placeholder="Receiver Username"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
          />

          <Input
            placeholder="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Button
            className="bg-cyan-600 hover:bg-cyan-500"
            onClick={handleCreateEscrow}
          >
            Lock Funds
          </Button>
        </CardContent>
      </Card>

      {/* Sent Escrows */}
      <div>
        <h3 className="text-xl font-semibold text-slate-200 mb-4">
          My Sent Escrows
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {sentEscrows.map((escrow) => (
            <Card
              key={escrow.escrow_id}
              className="bg-slate-900/60 border-slate-800"
            >
              <CardContent className="p-6 space-y-4">

                <div className="flex justify-between">
                  <p className="font-mono">
                    {escrow.escrow_id}
                  </p>
                  <Badge className={statusColor(escrow.status)}>
                    {escrow.status}
                  </Badge>
                </div>

                <p>To: {escrow.receiver_id}</p>
                <p>Amount: ₹{escrow.amount}</p>

                {escrow.status === "LOCKED" && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() =>
                        handleRelease(escrow.escrow_id)
                      }
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      Release
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() =>
                        handleRefund(escrow.escrow_id)
                      }
                    >
                      Refund
                    </Button>
                  </div>
                )}

              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Incoming Escrows */}
      <div>
        <h3 className="text-xl font-semibold text-slate-200 mb-4">
          Incoming Escrows
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {incomingEscrows.map((escrow) => (
            <Card
              key={escrow.escrow_id}
              className="bg-slate-900/60 border-slate-800"
            >
              <CardContent className="p-6 space-y-4">

                <div className="flex justify-between">
                  <p className="font-mono">
                    {escrow.escrow_id}
                  </p>
                  <Badge className={statusColor(escrow.status)}>
                    {escrow.status}
                  </Badge>
                </div>

                <p>From: {escrow.sender_id}</p>
                <p>Amount: ₹{escrow.amount}</p>

              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    </div>
  )
}
