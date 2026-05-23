import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Camera, ScanLine, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <ScanLine className="h-5 w-5" />
            </span>
            PlateWatch
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Button asChild size="sm"><Link to="/login">Get started</Link></Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                AI-powered plate recognition
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">
                Snap a photo. <span className="text-primary">Get the plate.</span> See the fine.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                PlateWatch reads vehicle license plates from any photo and instantly matches them
                against your fines database — built for parking officers, fleet managers, and gate security.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="shadow-[var(--shadow-glow)]">
                  <Link to="/login">Start detecting plates</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
            <div className="relative rounded-2xl border border-border bg-card p-6">
              <div className="absolute -inset-1 -z-10 rounded-2xl opacity-30 blur-2xl" style={{ background: "var(--gradient-amber)" }} />
              <div className="space-y-4">
                {[
                  { icon: Camera, title: "Upload car photo", desc: "Drag in a JPG/PNG of the vehicle." },
                  { icon: ScanLine, title: "AI reads the plate", desc: "Gemini vision extracts the plate text." },
                  { icon: FileText, title: "Match against fines", desc: "Instantly see the amount owed." },
                  { icon: ShieldCheck, title: "Private to you", desc: "Your database, your rules." },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3">
                    <Icon className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="text-sm text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Built with Lovable Cloud · PlateWatch
      </footer>
    </div>
  );
}
