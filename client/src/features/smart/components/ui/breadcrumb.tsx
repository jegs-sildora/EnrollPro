// @ts-nocheck
import * as React from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/features/smart/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center text-sm text-gray-500 mb-4",
        className
      )}
    >
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
              )}
              {isLast ? (
                <span className="font-medium text-gray-900 flex items-center gap-1.5">
                  {item.icon}
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  to={item.href}
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  {item.icon || (index === 0 && <Home className="w-4 h-4" />)}
                  {item.label}
                </Link>
              ) : (
                <span className="flex items-center gap-1.5">
                  {item.icon}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
