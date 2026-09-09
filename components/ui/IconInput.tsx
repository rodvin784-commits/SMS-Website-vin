'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

interface IconInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type: 'email' | 'password' | 'text'
  label?: string
  error?: string
  showTogglePassword?: boolean
  onTogglePassword?: () => void
}

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ type, label, error, showTogglePassword, onTogglePassword, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(type === 'password' ? false : undefined)

    const inputType = type === 'password' && showPassword ? 'text' : type

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
            {type === 'email' && <Mail className="h-5 w-5" />}
            {type === 'password' && <Lock className="h-5 w-5" />}
            {type === 'text' && !props.placeholder && <Mail className="h-5 w-5" />}
          </div>
          <input
            ref={ref}
            type={inputType}
            className={`
              w-full rounded-2xl border bg-white py-3 pl-12 pr-12 text-sm text-gray-900
              placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10
              transition-all shadow-sm
              ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : 'border-sky-200/70 focus:border-blue-600 focus:ring-blue-600/10'}
            `}
            {...props}
          />
          {type === 'password' && showTogglePassword !== false && (
            <button
              type="button"
              onClick={() => {
                setShowPassword(!showPassword)
                onTogglePassword?.()
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
      </div>
    )
  }
)

IconInput.displayName = 'IconInput'

import { useState } from 'react'
