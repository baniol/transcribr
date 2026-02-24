import { clsx } from "clsx";

interface ProgressBarProps {
  progress: number;
  className?: string;
  showLabel?: boolean;
  indeterminate?: boolean;
}

export function ProgressBar({
  progress,
  className,
  showLabel = true,
  indeterminate = false,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={clsx("w-full", className)}>
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {indeterminate ? (
          <div
            className="h-full bg-blue-600 animate-progress-indeterminate"
            style={{ width: "30%" }}
          />
        ) : (
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        )}
      </div>
      {showLabel && !indeterminate && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 text-right">
          {clampedProgress.toFixed(1)}%
        </p>
      )}
    </div>
  );
}
