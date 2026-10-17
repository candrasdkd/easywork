import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    helperText?: string;
    error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, helperText, error, className = '', ...props }, ref) => {
        const inputClasses = `
            w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all outline-none placeholder:text-slate-400
            ${error
                ? 'border-rose-400 focus:ring-2 focus:ring-rose-100'
                : 'border-slate-300 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-teal-400'}
            ${props.disabled ? 'cursor-not-allowed bg-slate-100 opacity-75' : ''}
            ${className}
        `;

        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300">
                        {label}
                        {props.required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                )}
                <input ref={ref} className={inputClasses.trim()} {...props} />
                {helperText && (
                    <p className={`text-xs ${error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {helperText}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
