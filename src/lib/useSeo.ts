import { useEffect } from "react";

interface SeoOptions {
  title: string;
  description?: string;
  /** Absolute URL or path. If omitted, derived from window.location.pathname on pixelskey.app. */
  canonical?: string;
  /** Open Graph content type for the current page. */
  type?: "website" | "product";
  /** Optional JSON-LD object(s) for structured data. */
  jsonLd?: object | object[];
}

const SITE_ORIGIN = "https://pixelskey.app";

const ensureMeta = (name: string, attr: "name" | "property" = "name") => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  return el;
};

const ensureLink = (rel: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  return el;
};

/** Build a clean canonical: enforce site origin, strip query/hash, collapse trailing slash. */
const normalizeCanonical = (input?: string): string => {
  let path: string;
  if (input) {
    if (/^https?:\/\//i.test(input)) {
      try {
        const u = new URL(input);
        path = u.pathname;
      } catch {
        path = "/";
      }
    } else {
      path = input.startsWith("/") ? input : `/${input}`;
    }
  } else {
    path = typeof window !== "undefined" ? window.location.pathname : "/";
  }
  // Drop trailing slash except for root
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return `${SITE_ORIGIN}${path}`;
};

const JSONLD_ID = "seo-jsonld";

const setJsonLd = (data?: object | object[]) => {
  // Remove previous managed scripts
  document.head
    .querySelectorAll(`script[data-managed="${JSONLD_ID}"]`)
    .forEach((n) => n.remove());
  if (!data) return;
  const items = Array.isArray(data) ? data : [data];
  items.forEach((obj) => {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.dataset.managed = JSONLD_ID;
    s.text = JSON.stringify(obj);
    document.head.appendChild(s);
  });
};

export const useSeo = ({ title, description, canonical, type = "website", jsonLd }: SeoOptions) => {
  useEffect(() => {
    const prevTitle = document.title;
    const fullTitle = title.length > 60 ? title.slice(0, 57) + "…" : title;
    document.title = fullTitle;

    const desc = description?.slice(0, 158);
    if (desc) ensureMeta("description").content = desc;

    // Open Graph
    ensureMeta("og:title", "property").content = fullTitle;
    if (desc) ensureMeta("og:description", "property").content = desc;
    ensureMeta("og:type", "property").content = type;

    // Twitter
    ensureMeta("twitter:card").content = "summary_large_image";
    ensureMeta("twitter:title").content = fullTitle;
    if (desc) ensureMeta("twitter:description").content = desc;

    // Canonical (always, normalized)
    const canonicalUrl = normalizeCanonical(canonical);
    ensureLink("canonical").href = canonicalUrl;
    ensureMeta("og:url", "property").content = canonicalUrl;

    // Structured data
    setJsonLd(jsonLd);

    return () => {
      document.title = prevTitle;
      setJsonLd(undefined);
    };
  }, [title, description, canonical, type, JSON.stringify(jsonLd)]);
};

export const SITE_URL = SITE_ORIGIN;
