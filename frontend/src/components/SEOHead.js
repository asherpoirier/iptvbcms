import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function SEOHead() {
  const { data: seo } = useQuery({
    queryKey: ['seo-settings'],
    queryFn: async () => { const r = await axios.get(`${API_URL}/api/seo`); return r.data; },
    staleTime: 300000,
  });

  const { data: branding } = useQuery({
    queryKey: ['branding-seo'],
    queryFn: async () => { const r = await axios.get(`${API_URL}/api/settings/branding`); return r.data; },
    staleTime: 300000,
  });

  useEffect(() => {
    const siteName = seo?.meta_title || branding?.site_name || '';
    const siteDesc = seo?.meta_description || branding?.tagline || '';

    // Title
    if (siteName) document.title = siteName;

    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', siteDesc);
    setMeta('name', 'keywords', seo?.meta_keywords);

    // Open Graph
    setMeta('property', 'og:title', seo?.og_title || siteName);
    setMeta('property', 'og:description', seo?.og_description || siteDesc);
    setMeta('property', 'og:image', seo?.og_image || branding?.logo_url);
    setMeta('property', 'og:site_name', siteName);
    setMeta('property', 'og:type', 'website');
    if (seo?.schema_url) setMeta('property', 'og:url', seo.schema_url);

    // Twitter Card
    setMeta('name', 'twitter:card', seo?.twitter_card);
    setMeta('name', 'twitter:title', seo?.og_title);
    setMeta('name', 'twitter:description', seo?.og_description);
    setMeta('name', 'twitter:image', seo?.og_image);

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (seo?.schema_url) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
      canonical.href = seo.schema_url + window.location.pathname;
    }

    // Favicon
    if (seo?.favicon_url) {
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon); }
      favicon.href = seo.favicon_url;
    }

    // JSON-LD Schema
    if (seo?.schema_name || seo?.schema_url) {
      let schema = document.querySelector('script[data-seo-schema]');
      if (!schema) { schema = document.createElement('script'); schema.type = 'application/ld+json'; schema.setAttribute('data-seo-schema', 'true'); document.head.appendChild(schema); }
      const schemaData = {
        "@context": "https://schema.org",
        "@type": seo?.schema_type || "Organization",
        "name": seo?.schema_name || siteName,
        "description": seo?.schema_description || siteDesc,
        "url": seo?.schema_url || "",
      };
      if (seo?.schema_logo) schemaData.logo = seo.schema_logo;
      if (seo?.schema_phone) schemaData.telephone = seo.schema_phone;
      if (seo?.schema_email) schemaData.email = seo.schema_email;
      schema.textContent = JSON.stringify(schemaData);
    }

    // Google Analytics
    if (seo?.google_analytics_id && !document.querySelector(`script[src*="${seo.google_analytics_id}"]`)) {
      const s = document.createElement('script'); s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${seo.google_analytics_id}`;
      document.head.appendChild(s);
      const s2 = document.createElement('script');
      s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${seo.google_analytics_id}');`;
      document.head.appendChild(s2);
    }

    // Google Tag Manager
    if (seo?.google_tag_manager_id && !document.querySelector(`script[src*="googletagmanager.com/gtm"]`)) {
      const s = document.createElement('script');
      s.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.google_tag_manager_id}');`;
      document.head.appendChild(s);
    }

    // Custom head code
    if (seo?.custom_head_code) {
      let custom = document.querySelector('[data-seo-custom]');
      if (!custom) { custom = document.createElement('div'); custom.setAttribute('data-seo-custom', 'true'); custom.style.display = 'none'; document.head.appendChild(custom); }
      custom.innerHTML = seo.custom_head_code;
      // Move actual elements from the div to head
      while (custom.firstChild) { document.head.appendChild(custom.firstChild); }
    }
  }, [seo, branding]);

  return null;
}
