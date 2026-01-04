type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
  message?: string;
};

export default function LoadingSpinner({
  size = "md",
  fullPage = false,
  message = "Loading...",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-8 w-8 border-2",
    md: "h-12 w-12 border-3",
    lg: "h-16 w-16 border-4",
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-brand-500 border-t-transparent`}
      ></div>
      {message && (
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        {spinner}
      </div>
    );
  }

  return <div className="flex items-center justify-center p-12">{spinner}</div>;
}
