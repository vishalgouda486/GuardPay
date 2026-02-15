"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"

export default function SignupPage() {
  const router = useRouter()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    if (!username || !password || !confirmPassword) {
      toast.error("All fields are required")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    try {
      setLoading(true)

      await api.post("/signup", {
        username,
        password,
      })

      toast.success("Account created successfully!")

      // Redirect to login after successful signup
      router.push("/auth/login")
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Signup failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <Card className="w-full max-w-md bg-slate-900/60 border-slate-800 backdrop-blur-md">
        <CardHeader className="text-center space-y-2">
          <ShieldCheck className="mx-auto text-cyan-400" size={32} />
          <CardTitle className="text-2xl text-cyan-400">
            Create GuardPay Account
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

          <Input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-500"
            onClick={handleSignup}
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/auth/login")}
          >
            Already have an account? Login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
