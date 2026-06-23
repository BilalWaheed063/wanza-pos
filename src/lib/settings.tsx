import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StoreSettings {
  store_name: string;
  store_phone: string;
  store_email: string;
  store_address: string;
  store_logo_url: string;
  currency: string;
  currency_symbol: string;
  tax_percent: number;
  receipt_footer: string;
  invoice_prefix: string;
  theme_color: string;
  setup_complete: boolean;
  low_stock_alert: boolean;
}

const defaults: StoreSettings = {
  store_name: "My Store",
  store_phone: "",
  store_email: "",
  store_address: "",
  store_logo_url: "",
  currency: "PKR",
  currency_symbol: "Rs.",
  tax_percent: 0,
  receipt_footer: "Thank you for shopping with us!",
  invoice_prefix: "INV",
  theme_color: "#0ea5e9",
  setup_complete: false,
  low_stock_alert: true,
};

function normalize(row: any): StoreSettings {
  if (!row) return defaults;
  return {
    store_name: row.store_name ?? defaults.store_name,
    store_phone: row.store_phone ?? "",
    store_email: row.store_email ?? "",
    store_address: row.store_address ?? "",
    store_logo_url: row.store_logo_url ?? "",
    currency: row.currency ?? defaults.currency,
    currency_symbol: row.currency_symbol ?? defaults.currency_symbol,
    tax_percent: Number(row.tax_percent ?? 0),
    receipt_footer: row.receipt_footer ?? defaults.receipt_footer,
    invoice_prefix: row.invoice_prefix ?? defaults.invoice_prefix,
    theme_color: row.theme_color ?? defaults.theme_color,
    setup_complete: Boolean(row.setup_complete),
    low_stock_alert: row.low_stock_alert ?? true,
  };
}

export function useSettings(): StoreSettings {
  return useSettingsQuery().data ?? defaults;
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { data } = await supabase.rpc("get_public_settings");
        const row = Array.isArray(data) ? data[0] : data;
        return normalize(row);
      }
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();

      if (error) throw error;

      return normalize(data);
    },
    staleTime: 60_000,
  });
}

/** Apply theme color as CSS variable on root. Hex -> HSL for tailwind tokens. */
export function useApplyTheme(color: string) {
  useEffect(() => {
    if (!color || typeof document === "undefined") return;
    const hsl = hexToHsl(color);
    if (!hsl) return;
    document.documentElement.style.setProperty("--primary", `hsl(${hsl})`);
    document.documentElement.style.setProperty("--ring", `hsl(${hsl})`);
    document.documentElement.style.setProperty("--sidebar-primary", `hsl(${hsl})`);
    const fg = contrastForeground(color);
    document.documentElement.style.setProperty("--primary-foreground", fg);
    document.documentElement.style.setProperty("--sidebar-primary-foreground", fg);
  }, [color]);
}

function hexToHsl(hex: string): string | null {
  const m = hex.trim().match(/^#?([a-f\d]{6}|[a-f\d]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let H = 0,
    S = 0;
  const L = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        H = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        H = (b - r) / d + 2;
        break;
      case b:
        H = (r - g) / d + 4;
        break;
    }
    H /= 6;
  }
  return `${Math.round(H * 360)} ${Math.round(S * 100)}% ${Math.round(L * 100)}%`;
}

function contrastForeground(hex: string): string {
  const m = hex.trim().match(/^#?([a-f\d]{6}|[a-f\d]{3})$/i);
  if (!m) return "#000000";
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#000000" : "#ffffff";
}

export function fmtMoney(n: number | string | null | undefined, symbol = "Rs.") {
  const v = Number(n ?? 0);
  return `${symbol} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
