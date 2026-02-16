"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Transaction {
  idempotency_key: string
  recipient: string
  amount: number
  type: string
  state: string
  direction: string
  timestamp: string
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const username =
    typeof window !== "undefined"
      ? localStorage.getItem("guardpay_user")
      : null

  useEffect(() => {
    if (!username) return

    const fetchHistory = async () => {
      try {
        const res = await api.get(`/transaction-history/${username}`)
        setTransactions(res.data.transactions)
      } catch (error) {
        console.error("Failed to fetch history:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  if (loading) {
    return <div className="text-slate-400">Loading transaction history...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold text-cyan-400">
        Transaction History
      </h2>

      {transactions.length === 0 && (
        <p className="text-slate-400">No transactions found.</p>
      )}

      {transactions.map((tx) => (
        <Card
          key={tx.idempotency_key}
          className="bg-slate-900/60 border-slate-800"
        >
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>{tx.type}</span>
              <div className="flex gap-2">
                <Badge
                  className={
                    tx.direction === "RECEIVED"
                      ? "bg-emerald-600"
                      : "bg-red-600"
                  }
                >
                  {tx.direction}
                </Badge>

                <Badge
                  className={
                    tx.state === "APPROVED"
                      ? "bg-cyan-600"
                      : "bg-orange-600"
                  }
                >
                  {tx.state}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-400">
            <p><strong>Amount:</strong> ₹{tx.amount}</p>
            <p><strong>Recipient:</strong> {tx.recipient}</p>
            <p><strong>Transaction ID:</strong> {tx.idempotency_key}</p>
            <p><strong>Date:</strong> {new Date(tx.timestamp).toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
