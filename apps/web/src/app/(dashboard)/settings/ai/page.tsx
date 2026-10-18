import { can } from "@pawpost/engine/permissions";
import type { Metadata } from "next";

import { LearnMore } from "@/components/help-link";
import { NoAccess } from "@/components/no-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSettingsForm } from "@/features/settings/ai-settings-form";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "AI settings" };

export default async function AiSettingsPage() {
  const { user } = await requireSession();
  if (!can(user.role, "settings.manage")) return <NoAccess what="AI settings" />;
  const ai = await engine().ai.status();

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI</CardTitle>
        <CardDescription>
          Writes and reviews sequences, and triages replies. Optional: everything else works without it.{" "}
          <LearnMore href="/help/ai-features">AI features</LearnMore>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AiSettingsForm status={ai} />
      </CardContent>
    </Card>
  );
}
