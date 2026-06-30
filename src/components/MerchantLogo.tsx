// Merchant logo — renders the hosted brand logo URL the BE resolves (Cloudinary,
// curated, privacy-safe; see BE services/spend/merchants). The BE sends the URL on
// the transaction (card feed merchant.logoUrl, global feed metadata.logoUrl); clients
// no longer carry their own merchant map. No URL → caller shows a colored-initial chip.
// Mirror of mobile FE/components/MerchantLogo.tsx.
export function MerchantLogo({ url, size = 44 }: { url: string; size?: number }) {
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      style={{ objectFit: "cover", borderRadius: "50%" }}
    />
  );
}
