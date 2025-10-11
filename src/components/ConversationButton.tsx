import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConversationButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
  className?: string;
}

export const ConversationButton = ({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
  ...rest
}: ConversationButtonProps) => {
  const variantStyles = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 min-h-[56px] h-14 text-base font-medium touch-optimized",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 min-h-[56px] h-14 text-base font-medium touch-optimized",
    outline: "border-2 border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background min-h-[56px] h-14 text-base font-medium touch-optimized",
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg transition-all duration-200",
        variantStyles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </Button>
  );
};
