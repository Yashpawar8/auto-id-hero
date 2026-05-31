import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, LogOut } from "lucide-react";
import DetectPanel from "@/components/plate/DetectPanel";
import VehiclesPanel from "@/components/plate/VehiclesPanel";
import HistoryPanel from "@/components/plate/HistoryPanel";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    // Server-side / SSR: no session storage → getUser() returns no user → redirect.
    // Client: re-validates the JWT against the auth server before the page renders,
    // so the authenticated dashboard shell is never served to unauthenticated requests.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
  head: () => ({ meta: [{ title: "Dashboard — MBES College" }] }),
});

function AppShell() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/login" });
      } else {
        setEmail(data.session.user.email ?? null);
      }
      setChecked(true);
    });
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  if (!checked) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!email) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            MBES College of Engineering
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
            <Button size="sm" variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="detect">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="detect">Detect</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles & Fines</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="detect" className="mt-6"><DetectPanel /></TabsContent>
          <TabsContent value="vehicles" className="mt-6"><VehiclesPanel /></TabsContent>
          <TabsContent value="history" className="mt-6"><HistoryPanel /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
