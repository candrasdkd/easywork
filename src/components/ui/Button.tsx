import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    startIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', loading, startIcon, children, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-xl font-semibold transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50';

        const variants = {
            primary: 'bg-teal-700 text-white shadow-sm shadow-teal-900/10 hover:bg-teal-800 focus:ring-teal-600',
            secondary: 'bg-slate-800 text-white shadow-sm hover:bg-slate-900 focus:ring-slate-600',
            success: 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 focus:ring-emerald-600',
            danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus:ring-rose-500',
            outline: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 focus:ring-teal-600',
            ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-400',
        };

        const sizes = {
            sm: 'px-3.5 py-2 text-sm',
            md: 'px-4.5 py-2.5 text-sm',
            lg: 'px-6 py-3 text-base',
        };

        const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

        return (
            <button ref={ref} className={classes} disabled={loading || props.disabled} {...props}>
                {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {startIcon && !loading && <span className="mr-2">{startIcon}</span>}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
