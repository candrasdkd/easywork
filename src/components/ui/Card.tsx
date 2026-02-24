import * as React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    glass?: boolean;
}

export const Card = ({ children, className = '', glass = true }: CardProps) => {
    const cardStyles = `
        rounded-2xl shadow-sm border
        ${glass
            ? 'backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-white/20 dark:border-slate-800/50'
            : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800'}
        ${className}
    `;

    return <div className={cardStyles.trim()}>{children}</div>;
};

export const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`px-6 py-4 border-b border-gray-100 dark:border-slate-800 ${className}`}>{children}</div>
);

export const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`p-6 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 rounded-b-2xl ${className}`}>{children}</div>
);
