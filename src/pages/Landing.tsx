import { useLocation, Link } from "react-router-dom";
import converselyBanner from "@/assets/conversely-banner-transparent.png";
import { Footer } from "@/components/Footer";

const Landing = () => {
  const location = useLocation();
  const isTestMode = location.search.includes('test=true');

  return (
    <div className={`min-h-screen flex flex-col items-center justify-between p-4 pb-20 sm:pb-8 animate-fade-in-gentle ${isTestMode ? 'pt-14' : ''}`}>
      {isTestMode && (
        <div className="fixed top-0 left-0 right-0 bg-destructive/10 border-b border-destructive/30 text-destructive text-center py-2 text-sm font-semibold z-50 shadow-sm">
          🧪 TEST MODE — Safe Development Environment
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mb-8">
            <img 
              src={converselyBanner} 
              alt="Conversely - Talk with someone unlike you" 
              className="max-w-[336px] w-full mx-auto"
              loading="eager"
              fetchPriority="high"
              width={336}
              height={120}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.createElement('h1');
                fallback.textContent = 'Conversely';
                fallback.className = 'text-4xl font-bold';
                e.currentTarget.parentElement?.appendChild(fallback);
              }}
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold">
              Talk with someone who sees things differently
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Short, anonymous conversations with people who are unlike you. No accounts. No history. Just a moment to converse.
            </p>
          </div>

          <div className="pt-6 space-y-4">
            <div className="bg-muted/30 border border-border/50 rounded-lg px-6 py-4 text-center">
              <p className="text-muted-foreground text-sm">
                Conversely is no longer active. Thank you for being part of it. 💛
              </p>
            </div>
            
            <Link
              to="/case-study"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline transition-colors"
            >
              Read the Story Behind Conversely →
            </Link>
          </div>
        </div>
      </div>

      <footer className="w-full pt-8 pb-4">
        <Footer variant="default" />
      </footer>
    </div>
  );
};

export default Landing;
