import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Shield, UserX, Trash2, ClipboardList, Users, Sparkles, LogOut, Heart } from "lucide-react";

interface AboutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AboutSheet = ({ open, onOpenChange }: AboutSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">About Conversely</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <p className="text-foreground/90 leading-relaxed text-base">
            Welcome to <span className="italic font-semibold text-primary">conversely</span>: a place for short, anonymous, one-on-one conversations 
            with people who are unlike you-- but not in the ways you think.
          </p>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              How It Works
            </h3>
            <ul className="space-y-3 text-foreground/80">
              <li className="flex items-start gap-3 animate-fade-in">
                <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>No account signup needed</span>
              </li>
              <li className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: "50ms" }}>
                <UserX className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Everything is anonymized</span>
              </li>
              <li className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: "100ms" }}>
                <Trash2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>No chat history is saved</span>
              </li>
              <li className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: "150ms" }}>
                <ClipboardList className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Answer simple survey questions</span>
              </li>
              <li className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: "200ms" }}>
                <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Get matched in real-time</span>
              </li>
              <li className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: "250ms" }}>
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Use ice breakers if needed</span>
              </li>
              <li className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: "300ms" }}>
                <LogOut className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Leave when you're done and come back when you're ready</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Our Mission
            </h3>
            <p className="text-foreground/90 leading-relaxed">
              <span className="italic font-semibold text-primary">conversely</span> was made with human connection in mind. Our hope is that we can 
              find common ground through conversation with those who are unlike us.
            </p>
          </div>

          <div className="pt-4 border-t border-border/40 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Conversely is no longer active, but you can read the full story.
            </p>
            <Link 
              to="/case-study" 
              className="text-sm font-semibold text-primary hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Read the Technical Case Study →
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
