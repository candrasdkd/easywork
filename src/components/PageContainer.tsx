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
    icon?: React.ReactNode;
}

export default function PageContainer(props: PageContainerProps) {
    const { children, breadcrumbs, title, actions = null, icon } = props;

    return (
        <div className="flex min-w-0 flex-1 flex-col pb-10">
            <div className="mb-7 border-b border-slate-200/80 pb-5 sm:mb-8 sm:pb-6">
                {/* Breadcrumbs */}
                {breadcrumbs && breadcrumbs.length > 0 && <nav className="mb-3 flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-gray-400">
                    {breadcrumbs?.map((breadcrumb, index) => (
                        <React.Fragment key={index}>
                            {breadcrumb.path ? (
                                <Link
                                    to={breadcrumb.path}
                                    className="transition-colors hover:text-teal-700 dark:hover:text-teal-400"
                                >
                                    {breadcrumb.title}
                                </Link>
                            ) : (
                                <span className="font-semibold text-slate-700 dark:text-white">
                                    {breadcrumb.title}
                                </span>
                            )}
                            {index < breadcrumbs.length - 1 && (
                                <svg className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </React.Fragment>
                    ))}
                </nav>}

                {/* Header */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-3.5">
                        {icon && (
                            <div className="shrink-0 [&>div]:!h-11 [&>div]:!w-11 [&>div]:!rounded-xl">
                                {icon}
                            </div>
                        )}
                        {title && (
                            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[1.8rem]">
                                {title}
                            </h1>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {actions}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex min-w-0 flex-1 flex-col">
                {children}
            </div>
        </div>
    );
}
