import * as React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    glass?: boolean;
}

export const Card = ({ children, className = '', glass = true }: CardProps) => {
    const cardStyles = `
        rounded-2xl border shadow-[0_1px_2px_rgba(20,45,52,0.04),0_8px_24px_rgba(20,45,52,0.035)]
        ${glass
            ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}
        ${className}
    `;

    return <div className={cardStyles.trim()}>{children}</div>;
};

export const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6 ${className}`}>{children}</div>
);

export const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`p-5 sm:p-6 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/30 sm:px-6 ${className}`}>{children}</div>
);
