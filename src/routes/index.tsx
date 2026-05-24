import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Camera, ScanLine, ShieldCheck, FileText, GraduationCap, Building2, Car } from "lucide-react";
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
              <GraduationCap className="h-5 w-5" />
            </span>
            MBES College of Engineering
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
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Campus Vehicle Management System
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
                Smart Vehicle Detection for <span className="text-primary">MBES Campus</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                AI-powered license plate recognition system for MBES College of Engineering. 
                Register vehicles, detect plates from photos, and manage campus parking fines — 
                built for the college administration and security team.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="shadow-[var(--shadow-glow)]">
                  <Link to="/login">Access System</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
            <div className="relative rounded-2xl border border-border bg-card p-6">
              <div className="absolute -inset-1 -z-10 rounded-2xl opacity-30 blur-2xl" style={{ background: "var(--gradient-primary)" }} />
              <div className="space-y-4">
                {[
                  { icon: Camera, title: "Upload vehicle photo", desc: "Drag in a photo of any campus vehicle." },
                  { icon: ScanLine, title: "AI reads the plate", desc: "Gemini vision extracts the plate number instantly." },
                  { icon: FileText, title: "Check registration & fines", desc: "See if the vehicle is registered or has fines." },
                  { icon: ShieldCheck, title: "Secure & private", desc: "College-only access with email authentication." },
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

        <section className="border-t border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { icon: Building2, title: "Campus Security", desc: "Empower security staff to quickly verify vehicles entering and exiting the college premises." },
                { icon: Car, title: "Parking Management", desc: "Track registered vehicles and enforce parking rules with an automated fine system." },
                { icon: GraduationCap, title: "Student & Staff", desc: "Manage vehicle registrations for students, faculty, and college staff in one place." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-6">
                  <Icon className="h-8 w-8 text-primary" />
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        MBES College of Engineering · Campus Vehicle Management System
      </footer>
    </div>
  );
}
