import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActivityLevel } from "@/types";

interface ActivityIndicatorProps {
  activityLevel: ActivityLevel;
  variant?: "badge" | "full";
  className?: string;
}

export const ActivityIndicator = ({ 
  activityLevel, 
  variant = "badge",
  className 
}: ActivityIndicatorProps) => {
  const getVariant = () => {
    switch (activityLevel.level) {
      case "active":
        return "default";
      case "building":
        return "secondary";
      case "quiet":
        return "outline";
      default:
        return "default";
    }
  };

  if (variant === "badge") {
    return (
      <Badge variant={getVariant()} className={cn("text-sm", className)}>
        <span className="mr-1.5">{activityLevel.icon}</span>
        {activityLevel.level.charAt(0).toUpperCase() + activityLevel.level.slice(1)}
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Badge variant={getVariant()}>
        <span className="mr-1.5">{activityLevel.icon}</span>
        {activityLevel.level.charAt(0).toUpperCase() + activityLevel.level.slice(1)}
      </Badge>
      <span className="text-muted-foreground">{activityLevel.message}</span>
    </div>
  );
};
