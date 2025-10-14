import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SRLoaderProps {
  text: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export const SRLoader = ({ text, className, size = "md" }: SRLoaderProps) => (
  <div role="status" aria-live="polite" className={cn("flex items-center justify-center", className)}>
    <Loader2 className={cn("animate-spin text-primary", sizeMap[size])} aria-hidden="true" />
    <span className="sr-only">{text}</span>
  </div>
);
