"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import api from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard } from "lucide-react"
import { toast } from "sonner"

interface GhostCard {
  card_id: string
  card_number: string
  cvv: string
  label: string
  amount_limit: number
  status: string
  owner: string
}

export default function GhostCardsPage() {
  const [cards, setCards] = useState<GhostCard[]>([])

  const [openCreate, setOpenCreate] = useState(false)
  const [openUse, setOpenUse] = useState(false)
  const [selectedCard, setSelectedCard] = useState<GhostCard | null>(null)

  const [label, setLabel] = useState("")
  const [limit, setLimit] = useState("")
  const [amount, setAmount] = useState("")

  const username =
    typeof window !== "undefined"
      ? localStorage.getItem("guardpay_user")
      : null

  const fetchCards = async () => {
    try {
      const res = await api.get(`/my-cards/${username}`)
      setCards(res.data.cards)
    } catch (error) {
      console.error("Failed to fetch cards:", error)
    }
  }

  useEffect(() => {
    if (username) {
      fetchCards()
    }
  }, [])

  // ---------------- CREATE CARD ----------------
  const handleCreateCard = async () => {
    if (!label || !limit) {
      toast.error("All fields are required")
      return
    }

    try {
      const res = await api.post("/generate-ghost-card", {
        username: username,
        label: label,
        amount_limit: Number(limit),
      })

      if (res.data.status === "CREATED") {
        toast.success("Ghost Card Created")
        setOpenCreate(false)
        setLabel("")
        setLimit("")
        fetchCards()
      } else {
        toast.error("Failed to create card")
      }
    } catch (error) {
      toast.error("Server error while creating card")
    }
  }

  // ---------------- USE CARD ----------------
  const handleUseCard = async () => {
    if (!amount || !selectedCard) {
      toast.error("Enter valid amount")
      return
    }

    const numericAmount = Number(amount)

    if (numericAmount <= 0) {
      toast.error("Amount must be greater than 0")
      return
    }

    // Frontend validation (UX layer)
    if (numericAmount > selectedCard.amount_limit) {
      toast.error("Amount exceeds card limit")
      return
    }

    try {
      const res = await api.post("/simulate-merchant-payment", {
        card_id: selectedCard.card_id,
        amount: numericAmount,
      })

      if (res.data.status === "SUCCESS") {
        toast.success("Payment Successful - Card Destroyed")
        setOpenUse(false)
        setAmount("")
        fetchCards()
      } else if (res.data.status === "DECLINED") {
        toast.error(res.data.reason || "Payment Declined")
      } else {
        toast.error("Unexpected response from server")
      }
    } catch (error) {
      toast.error("Server error during payment")
    }
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-semibold text-cyan-400">
            Ghost Card Vault
          </h2>
          <p className="text-slate-400 mt-1">
            Disposable virtual cards with fraud containment
          </p>
        </div>

        <Button
          className="bg-cyan-600 hover:bg-cyan-500"
          onClick={() => setOpenCreate(true)}
        >
          Create New Card
        </Button>
      </div>

      {/* Card Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <Card
            key={card.card_id}
            className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700"
          >
            <CardContent className="p-6 space-y-4">

              <div className="flex justify-between items-center">
                <CreditCard className="text-cyan-400" />
                <Badge
                  className={
                    card.status === "Active"
                      ? "bg-emerald-600"
                      : "bg-red-600"
                  }
                >
                  {card.status}
                </Badge>
              </div>

              <div className="text-lg tracking-widest font-mono">
                {card.card_number}
              </div>

              <div className="text-sm text-slate-400">
                CVV: {card.cvv}
              </div>

              <div className="text-sm text-slate-400">
                Label: {card.label}
              </div>

              <div className="text-sm text-slate-400">
                Limit: ₹{card.amount_limit}
              </div>

              {card.status === "Active" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedCard(card)
                    setOpenUse(true)
                  }}
                >
                  Use Card
                </Button>
              )}

            </CardContent>
          </Card>
        ))}
      </div>

      {/* -------- CREATE MODAL -------- */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Ghost Card</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Label (e.g. Amazon)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />

            <Input
              placeholder="Spending Limit"
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button onClick={handleCreateCard}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- USE MODAL -------- */}
      <Dialog open={openUse} onOpenChange={setOpenUse}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use Ghost Card</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Card: {selectedCard?.card_number}
            </p>

            <Input
              placeholder="Enter amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button onClick={handleUseCard}>
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
