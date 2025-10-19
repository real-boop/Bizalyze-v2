import React, { useState } from "react"
import { X, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface ChangeNameModalProps {
  isOpen: boolean
  onClose: () => void
  currentName: string
  onNameUpdated: (newName: string) => void
}

const ChangeNameModal: React.FC<ChangeNameModalProps> = ({ 
  isOpen, 
  onClose, 
  currentName, 
  onNameUpdated 
}) => {
  const [newName, setNewName] = useState(currentName)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdateName = async () => {
    if (newName.length < 2) {
      toast.error("Display name must be at least 2 characters")
      return
    }

    if (newName.length > 30) {
      toast.error("Display name must be less than 30 characters")
      return
    }

    setIsUpdating(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: newName }
      })
      
      if (error) {
        toast.error("Failed to update display name")
      } else {
        toast.success("Display name updated successfully")
        onNameUpdated(newName)
        onClose()
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Change Display Name</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your display name"
                maxLength={30}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {newName.length}/30 characters
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleUpdateName}
            disabled={isUpdating || !newName.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChangeNameModal
