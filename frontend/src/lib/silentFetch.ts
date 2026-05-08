// src/lib/silentFetch.ts
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

// fetch natif ne logue PAS les erreurs 4xx dans la console navigateur
// contrairement à axios qui les affiche toujours en rouge
export async function silentPost<T = any>(
  path: string,
  body: object,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.message ?? "Erreur réseau") as any;
    err.response = { status: res.status, data };
    err.isSilentFetch = true;
    throw err;
  }

  return data;
}