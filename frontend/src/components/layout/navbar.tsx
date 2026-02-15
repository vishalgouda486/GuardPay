"use client"

import { ShieldCheck, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Navbar() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const user = localStorage.getItem("guardpay_user")
    setUsername(user)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("guardpay_user")
    router.push("/auth/login")
  }

  return (
    <nav className="w-full border-b border-slate-800 bg-slate-900/50 backdrop-blur-lg">
      <div className="flex items-center justify-between px-6 py-4">

        <div className="flex items-center gap-3">
          <ShieldCheck className="text-cyan-400" size={28} />
          <h1 className="text-xl font-semibold tracking-wide text-cyan-400">
            GuardPay
          </h1>
        </div>

        {username && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <User size={16} className="mr-2" />
                {username}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
              <DropdownMenuItem
                className="hover:bg-slate-800 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut size={16} className="mr-2 text-red-400" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

      </div>
    </nav>
  )
}
