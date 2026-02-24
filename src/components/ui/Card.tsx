import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function Card({
  children,
  className,
  hoverable = false,
  ...props
}: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          "rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
          hoverable &&
            "cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
        ),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
