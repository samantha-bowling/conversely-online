import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
          <p className="text-foreground/90 leading-relaxed">
            Welcome to conversely: a place for short, anonymous, one-on-one conversations 
            with people who are unlike you-- but not in the ways you think.
          </p>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">How It Works</h3>
            <ul className="space-y-2 text-foreground/80">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>No account signup needed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Everything is anonymized</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>No chat history is saved</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Answer simple survey questions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Get matched in real-time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Use ice breakers if needed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Leave when you're done and come back when you're ready</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Our Mission</h3>
            <p className="text-foreground/90 leading-relaxed italic">
              conversely was made with human connection in mind. Our hope is that we can 
              find common ground through conversation with those who are unlike us.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
