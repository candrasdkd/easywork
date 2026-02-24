import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    helperText?: string;
    error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, helperText, error, className = '', ...props }, ref) => {
        const inputClasses = `
            w-full px-4 py-2 rounded-lg border transition-all outline-none
            ${error
                ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400'}
            ${props.disabled ? 'bg-gray-100 cursor-not-allowed opacity-75' : 'bg-white'}
            ${className}
        `;

        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
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
