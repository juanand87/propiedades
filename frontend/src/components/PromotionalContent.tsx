"use client";

import type { CSSProperties } from "react";
import Banner from "@/components/Banner";
import HeroSlider from "@/components/HeroSlider";

interface PromotionalContentProps {
  carousels?: any[];
  banners?: any[];
  position: "top" | "middle" | "bottom";
  vendorSlug: string;
  sliderConfig?: any;
  vendorSettings?: any;
}

export default function PromotionalContent({ carousels = [], banners = [], position, vendorSlug, sliderConfig = {}, vendorSettings }: PromotionalContentProps) {
  const items = [
    ...carousels.filter((item) => item.showInHomepage === true && (item.position || "top") === position).map((item) => ({ ...item, contentType: "carousel" })),
    ...banners.filter((item) => item.isActive !== false && (item.position || "top") === position).map((item) => ({ ...item, contentType: "banner" })),
  ].map((item, index) => ({ ...item, promotionOrder: item.promotionOrder ?? index })).sort((a, b) => Number(a.promotionOrder) - Number(b.promotionOrder));

  if (items.length === 0) return null;

  const hasScrollEffect = position === "top" && items.some((item) =>
    item.contentType === "carousel" && ["fixed-overlay", "fixed-zoom"].includes(item.scrollEffect)
  );

  return <div className={hasScrollEffect ? "store-carousel-scroll-container" : undefined}>{items.map((item) => {
    const usePageMargins = item.usePageMargins ?? (item.contentType === "carousel" || position !== "top");
    const wrapperClass = usePageMargins ? "mx-auto my-6 w-full max-w-[1300px] px-4" : "w-full";
    if (item.contentType === "carousel") {
      const scrollEffect = position === "top" ? (item.scrollEffect || "normal") : "normal";
      const usesFixedEffect = scrollEffect === "fixed-overlay" || scrollEffect === "fixed-zoom";
      const sliderHeight = Number(sliderConfig?.height || 400);
      const sceneStyle = usesFixedEffect ? {
        "--store-carousel-height": `${sliderHeight}px`,
        "--store-carousel-overlap": `${Math.min(240, Math.max(140, Math.round(sliderHeight * 0.45)))}px`,
      } as CSSProperties : undefined;

      return (
        <div
          key={`carousel-${item.id}`}
          className={`${wrapperClass}${usesFixedEffect ? " store-carousel-scroll-scene" : ""}`}
          style={sceneStyle}
        >
          <div className={usesFixedEffect ? "store-carousel-scroll-sticky" : undefined}>
            <HeroSlider
              config={{ autoplay: true, interval: 5, showArrows: true, showDots: true, height: 400, ...sliderConfig, scrollEffect, enabled: true, sliderId: item.id, overlayCards: { ...sliderConfig?.overlayCards, enabled: false, items: [] } }}
              slides={carousels}
              vendorSlug={vendorSlug}
            />
          </div>
        </div>
      );
    }

    return (
    <div key={`banner-${item.id}`} className={wrapperClass}>
      <Banner type={item.type} config={item.config} vendorSlug={vendorSlug} deviceVisibility={item.deviceVisibility} vendorSettings={vendorSettings} />
    </div>
    );
  })}</div>;
}
