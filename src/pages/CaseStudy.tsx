import { Link } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { 
  ArrowLeft, Shield, Users, MessageSquare, Zap, Lock, 
  Server, Globe, Clock, Heart, Code, Database, 
  RefreshCw, Eye, Sparkles, AlertTriangle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`py-12 sm:py-16 ${className}`}>
    {children}
  </section>
);

const SectionTitle = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
  <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3">
    <Icon className="w-7 h-7 text-primary shrink-0" />
    {children}
  </h2>
);

const CaseStudy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Conversely
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4">
        {/* Hero */}
        <Section>
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-muted/50 text-muted-foreground text-sm px-4 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              Project Retrospective · 2025
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
              Building <span className="italic text-primary">Conversely</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A technical case study on designing an anonymous, real-time platform for conversations 
              between people with opposing viewpoints.
            </p>
            <div className="pt-2">
              <span className="text-sm text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">
                This project has been sunset — thank you to everyone who participated.
              </span>
            </div>
          </div>
        </Section>

        <hr className="border-border/40" />

        {/* The Problem */}
        <Section>
          <SectionTitle icon={Heart}>The Problem</SectionTitle>
          <div className="space-y-4 text-foreground/85 leading-relaxed text-base">
            <p>
              Online discourse has become increasingly polarized. People retreat into echo chambers, 
              engaging only with those who share their views. The platforms we use every day optimize 
              for engagement — which often means outrage — rather than understanding.
            </p>
            <p>
              <span className="italic font-semibold text-primary">Conversely</span> was built on a simple hypothesis: 
              if you could have a short, anonymous, one-on-one conversation with someone who genuinely 
              sees the world differently, you might find more common ground than you'd expect.
            </p>
            <p>
              No accounts. No history. No social pressure. Just two people, matched by their differences, 
              having a real conversation.
            </p>
          </div>
        </Section>

        <hr className="border-border/40" />

        {/* How It Worked */}
        <Section>
          <SectionTitle icon={Users}>How It Worked</SectionTitle>
          <p className="text-muted-foreground mb-8">
            The user journey was designed to be frictionless — under 5 minutes from landing page to live conversation.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { step: "1", title: "Age Verification", desc: "Quick age gate with legal consent and terms acceptance. No account creation required.", icon: Shield },
              { step: "2", title: "Survey", desc: "5 randomized questions drawn from a pool of 60+ covering politics, ethics, lifestyle, and values.", icon: Sparkles },
              { step: "3", title: "Real-Time Matching", desc: "Algorithmic opposite-matching based on survey response divergence, with live presence tracking.", icon: Zap },
              { step: "4", title: "Ephemeral Chat", desc: "Timed, anonymous conversation with ice-breaker prompts. Messages auto-delete after the session.", icon: MessageSquare },
              { step: "5", title: "Reflection", desc: "Optional post-chat reflection: rate the conversation and share thoughts on the experience.", icon: Eye },
              { step: "6", title: "Clean Exit", desc: "All data ephemeral. Leave anytime. Come back when ready for a new conversation.", icon: RefreshCw },
            ].map(({ step, title, desc, icon: Icon }) => (
              <Card key={step} className="border-border/50 bg-card/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Step {step}</p>
                      <h3 className="font-semibold mb-1">{title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <hr className="border-border/40" />

        {/* Technical Architecture */}
        <Section>
          <SectionTitle icon={Server}>Technical Architecture</SectionTitle>
          <p className="text-muted-foreground mb-6">
            Conversely was a fully serverless application with real-time capabilities, built for ephemeral data flows.
          </p>
          <div className="bg-muted/30 border border-border/50 rounded-lg p-6 font-mono text-sm leading-loose overflow-x-auto">
            <pre className="text-foreground/80">{`┌─────────────────────────────────────────────────┐
│                    Client                       │
│  React 18 + Vite 5 + TypeScript + Tailwind CSS  │
│  shadcn/ui components · React Router            │
└───────────────────┬─────────────────────────────┘
                    │ HTTPS / WSS
┌───────────────────▼─────────────────────────────┐
│              Backend Functions                   │
│  15+ serverless functions (Deno runtime)        │
│  Session mgmt · Matching · Messaging · Reports  │
│  Rate limiting · Content filtering · GDPR       │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│               Database Layer                    │
│  PostgreSQL with Row-Level Security (RLS)       │
│  Real-time subscriptions (WebSocket)            │
│  Scheduled maintenance (cron jobs)              │
│  Tables: sessions, rooms, messages, surveys,    │
│          reflections, blocked_pairs, logs       │
└─────────────────────────────────────────────────┘`}</pre>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> Frontend
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• React 18 with TypeScript</li>
                <li>• Vite 5 for build tooling</li>
                <li>• Tailwind CSS + shadcn/ui</li>
                <li>• Real-time WebSocket subscriptions</li>
                <li>• Optimistic UI with message queuing</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> Backend
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 15+ edge functions (Deno)</li>
                <li>• Anonymous guest auth</li>
                <li>• Advisory lock-based matching</li>
                <li>• Heartbeat presence system</li>
                <li>• Automated maintenance jobs</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" /> Data
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• PostgreSQL with RLS policies</li>
                <li>• Ephemeral message TTLs</li>
                <li>• Auto-expiring sessions</li>
                <li>• Cron-based data cleanup</li>
                <li>• Zero long-term data retention</li>
              </ul>
            </div>
          </div>
        </Section>

        <hr className="border-border/40" />

        {/* Matching Algorithm */}
        <Section>
          <SectionTitle icon={Zap}>The Matching Algorithm</SectionTitle>
          <div className="space-y-6 text-foreground/85 leading-relaxed">
            <p>
              The core innovation of Conversely was its <strong>"opposite matching"</strong> system — 
              pairing users who answered survey questions most differently from each other.
            </p>
            
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6 space-y-4">
                <h4 className="font-semibold">How Scoring Worked</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">1.</span>
                    Each survey question had ordered answer options (e.g., Strongly Agree → Strongly Disagree)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">2.</span>
                    The system compared overlapping questions between two users
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">3.</span>
                    A divergence score was calculated — the average positional distance between answers
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">4.</span>
                    Pairs needed a <strong>60%+ divergence threshold</strong> to be considered a match
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">5.</span>
                    A reputation system weighted matches — users who ghosted or were blocked got deprioritized
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6 space-y-4">
                <h4 className="font-semibold">Race Condition Handling</h4>
                <p className="text-sm text-muted-foreground">
                  With multiple users searching simultaneously, matching had to be atomic. 
                  The system used <strong>PostgreSQL advisory locks</strong> to ensure that two matching 
                  requests couldn't claim the same user. Each match attempt locked the candidate's session ID, 
                  verified availability, created the chat room, and released the lock — all in a single 
                  database transaction via the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">atomic_create_match_room</code> function.
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        <hr className="border-border/40" />

        {/* Privacy & Security */}
        <Section>
          <SectionTitle icon={Lock}>Privacy & Security</SectionTitle>
          <p className="text-muted-foreground mb-6">
            Privacy wasn't an afterthought — it was the foundation. Every design decision started with 
            "how do we do this without storing personal data?"
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Zero-Knowledge Design", desc: "No email, no passwords, no PII collected. Guest sessions used anonymous auth tokens that expired automatically." },
              { title: "Ephemeral Messages", desc: "Every message had a TTL. Automated cron jobs swept expired messages, and sessions self-destructed after their time window." },
              { title: "GDPR Compliance", desc: "Full data export and deletion endpoints. Users could request all their data or have it erased — even without an account." },
              { title: "hCaptcha Integration", desc: "Bot prevention without tracking. hCaptcha was chosen over reCAPTCHA specifically for its privacy-respecting approach." },
              { title: "Rate Limiting", desc: "Multi-layer rate limiting on matching, messaging, and reporting to prevent abuse without impacting legitimate users." },
              { title: "Content Filtering", desc: "Server-side message validation with length limits and pattern checks, plus client-side input sanitization." },
              { title: "Row-Level Security", desc: "Every database table had RLS policies ensuring users could only access their own session data and room messages." },
              { title: "Incident Response", desc: "Documented escalation procedures, Discord alerting, and automated monitoring for anomalous patterns." },
            ].map(({ title, desc }) => (
              <Card key={title} className="border-border/50 bg-card/50">
                <CardContent className="p-5">
                  <h4 className="font-semibold mb-2 text-sm">{title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <hr className="border-border/40" />

        {/* Challenges & Lessons */}
        <Section>
          <SectionTitle icon={AlertTriangle}>Challenges & Lessons Learned</SectionTitle>
          <div className="space-y-6">
            {[
              {
                title: "Race Conditions in Real-Time Matching",
                lesson: "Early versions had a bug where two users could both 'claim' the same match simultaneously. The fix required moving from optimistic client-side matching to server-side advisory locks with atomic room creation. Lesson: real-time multiplayer state is genuinely hard — design for conflicts from day one."
              },
              {
                title: "Mobile Keyboard & Layout Shifts",
                lesson: "The virtual keyboard on mobile devices caused constant layout recalculations, pushing the chat input off-screen or creating white space gaps. Solution involved CSS environment variables (env(safe-area-inset-bottom)), viewport height workarounds, and careful management of resize events. Lesson: mobile web chat UX requires disproportionate engineering effort."
              },
              {
                title: "Ephemeral UX Expectations",
                lesson: "Users expected 'ephemeral' to mean different things. Some wanted messages to visually disappear in real-time, others expected transcript export before deletion. The balance was: messages persist during the session but are permanently deleted by cron jobs after expiry. Lesson: define 'ephemeral' precisely in your UX copy."
              },
              {
                title: "Balancing Safety with Anonymity",
                lesson: "Full anonymity makes moderation extremely difficult. The system used reputation scoring, block lists, cooldown periods, and automated ghost detection — but without identity, there's always a limit to enforcement. Lesson: anonymous platforms need layered behavioral signals, not just content filtering."
              },
            ].map(({ title, lesson }) => (
              <div key={title} className="border-l-2 border-primary/30 pl-5">
                <h4 className="font-semibold mb-2">{title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{lesson}</p>
              </div>
            ))}
          </div>
        </Section>

        <hr className="border-border/40" />

        {/* Tech Stack */}
        <Section>
          <SectionTitle icon={Code}>Tech Stack</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              "React 18", "TypeScript 5", "Vite 5", "Tailwind CSS",
              "shadcn/ui", "React Router", "PostgreSQL", "Deno Runtime",
              "WebSockets", "hCaptcha", "Row-Level Security", "Edge Functions",
            ].map((tech) => (
              <div 
                key={tech}
                className="bg-muted/30 border border-border/50 rounded-lg px-4 py-3 text-center text-sm font-medium"
              >
                {tech}
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t border-border/40 py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Built with care by the Conversely team. Questions or thoughts?
            </p>
            <a 
              href="mailto:hello@conversely.online" 
              className="text-primary hover:underline text-sm"
            >
              hello@conversely.online
            </a>
          </div>
          <div className="mt-8">
            <Footer variant="legal" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CaseStudy;
