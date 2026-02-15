"use client"

import {
  LayoutDashboard,
  Send,
  CreditCard,
  Shield,
  Lock,
  Settings,
} from "lucide-react"
import Link from "next/link"

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "Smart Transfer", icon: Send, href: "/transfer" },
  { name: "Ghost Cards", icon: CreditCard, href: "/ghost-cards" },
  { name: "Escrow", icon: Lock, href: "/escrow" },
  { name: "Admin", icon: Shield, href: "/admin" },
]

export default function Sidebar() {
  return (
    <aside className="h-screen w-64 border-r border-slate-800 bg-slate-900/40 backdrop-blur-lg p-6 hidden md:block">
      <div className="space-y-6">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <item.icon size={18} />
            <span className="text-sm font-medium">{item.name}</span>
          </Link>
        ))}
      </div>
    </aside>
  )
}
