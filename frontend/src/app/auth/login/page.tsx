"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    try {
      setLoading(true)

      const res = await api.post("/login", {
        username,
        password,
      })

      // Save user in localStorage
      localStorage.setItem("guardpay_user", username)

      toast.success("Login successful!")

      router.push("/")
    } catch (error: any) {
      toast.error("Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <Card className="w-full max-w-md bg-slate-900/60 border-slate-800 backdrop-blur-md">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto text-cyan-400" size={32} />
          <CardTitle className="text-2xl text-cyan-400">
            GuardPay Login
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-500"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Login"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
