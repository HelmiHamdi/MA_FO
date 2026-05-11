// src/app/(app)/discovery/swipe/page.tsx
// Cette page existe uniquement pour éviter le 404 quand une notification
// ou un deepLink pointe vers /discovery/swipe.
// Elle redirige immédiatement vers /discovery où le mode swipe est géré.
import { redirect } from "next/navigation";

export default function DiscoverySwipePage() {
  redirect("/discovery");
}