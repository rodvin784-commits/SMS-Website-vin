'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  placeholder?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, iconPosition = 'left', className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && iconPosition === 'left' && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-2xl border bg-white py-3 pl-12 pr-4 text-sm text-gray-900
              placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10
              transition-all shadow-sm
              ${
                error
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                  : 'border-sky-200/70 focus:border-blue-600 focus:ring-blue-600/10'
              }
              ${icon && iconPosition === 'left' ? 'pl-12' : 'pl-4'}
              ${props.type === 'password' ? 'pr-12' : 'pr-4'}
              ${className}
            `}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400">
              {icon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
