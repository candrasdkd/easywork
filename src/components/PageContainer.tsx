import * as React from 'react';
import { Link } from 'react-router';

export interface Breadcrumb {
    title: string;
    path?: string;
}

export interface PageContainerProps {
    children?: React.ReactNode;
    title?: string;
    breadcrumbs?: Breadcrumb[];
    actions?: React.ReactNode;
}

export default function PageContainer(props: PageContainerProps) {
    const { children, breadcrumbs, title, actions = null } = props;

    return (
        <div className="flex flex-col flex-1 pb-10">
            <div className="mb-6">
                {/* Breadcrumbs */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {breadcrumbs?.map((breadcrumb, index) => (
                        <React.Fragment key={index}>
                            {breadcrumb.path ? (
                                <Link
                                    to={breadcrumb.path}
                                    className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                    {breadcrumb.title}
                                </Link>
                            ) : (
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {breadcrumb.title}
                                </span>
                            )}
                            {index < breadcrumbs.length - 1 && (
                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </React.Fragment>
                    ))}
                </nav>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {title && (
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {title}
                        </h1>
                    )}
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col">
                {children}
            </div>
        </div>
    );
}