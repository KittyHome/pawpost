import { cookies } from "next/headers";

import { LandingPage } from "@/features/marketing/landing-page";

export default async function HomePage() {
  const signedIn = Boolean((await cookies()).get("pawpost_session")?.value);
  return <LandingPage signedIn={signedIn} />;
}
