import type { Comp, CompsResult } from "./types";

const ENV = process.env.EBAY_ENV === "sandbox" ? "sandbox" : "production";
const API_BASE =
  ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
const AUTH_BASE =
  ENV === "sandbox"
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });
  const res = await fetch(AUTH_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`eBay auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

type BrowseItem = {
  title: string;
  price?: { value: string; currency: string };
  itemWebUrl: string;
  image?: { imageUrl?: string };
  thumbnailImages?: { imageUrl: string }[];
  condition?: string;
};

export async function searchComps(query: string, limit = 24): Promise<CompsResult> {
  const token = await getAppToken();
  const url = new URL(`${API_BASE}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},priceCurrency:USD");
  url.searchParams.set("sort", "price");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  if (!res.ok) throw new Error(`eBay search failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { itemSummaries?: BrowseItem[] };

  const items = json.itemSummaries ?? [];
  const samples: Comp[] = items
    .filter((i) => i.price && Number.isFinite(Number(i.price.value)))
    .map((i) => ({
      title: i.title,
      price: Number(i.price!.value),
      currency: i.price!.currency,
      url: i.itemWebUrl,
      image: i.image?.imageUrl ?? i.thumbnailImages?.[0]?.imageUrl,
      condition: i.condition,
    }));

  const prices = samples.map((s) => s.price).sort((a, b) => a - b);
  const median = pct(prices, 0.5);
  const p25 = pct(prices, 0.25);
  const p75 = pct(prices, 0.75);

  return {
    query,
    count: samples.length,
    median,
    p25,
    p75,
    currency: samples[0]?.currency ?? "USD",
    samples: samples.slice(0, 8),
  };
}

function pct(sorted: number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}
