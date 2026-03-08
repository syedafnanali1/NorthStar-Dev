// src/components/ui/skeleton.tsx
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn("skeleton", className)} style={style} />;
}

export function GoalCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4 mb-4">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="w-12 h-12 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function MomentumSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="w-24 h-24 rounded-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${20 + Math.random() * 40}px` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
