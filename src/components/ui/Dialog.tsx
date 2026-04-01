import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { Button } from "./Button"

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function Dialog({ isOpen, onClose, title, description, children }: DialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-card border rounded-xl shadow-lg animate-in fade-in zoom-in duration-200 my-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b bg-card rounded-t-xl">
          <div className="space-y-1">
            <h2 className="text-xl font-bold leading-none tracking-tight">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
