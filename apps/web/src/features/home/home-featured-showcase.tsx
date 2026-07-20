"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePageVisibility } from "../../lib/use-page-visibility";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";

const ROTATION_INTERVAL_MS = 2500;

const showcaseSlides = [
  {
    alt: "İyi durumda bebek arabası, taşıma çantası ve kanguru ürünleri",
    src: "/brand/home/home-hero-travel.png"
  },
  {
    alt: "İyi durumda uyku tekstili, bebek telsizi ve oda ürünleri",
    src: "/brand/home/home-hero-sleep.png"
  },
  {
    alt: "İyi durumda mama sandalyesi, biberon ve beslenme ürünleri",
    src: "/brand/home/home-hero-feeding.png"
  },
  {
    alt: "İyi durumda oyuncak, aktivite ve çocuk gelişim ürünleri",
    src: "/brand/home/home-hero-play.png"
  }
] as const;

export function HomeFeaturedShowcase() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRotationPaused, setIsRotationPaused] = useState(false);
  const isPageVisible = usePageVisibility();

  function scrollToLatestListings() {
    document.getElementById("latest-listings")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start"
    });
  }

  useEffect(() => {
    if (!isPageVisible || isRotationPaused || prefersReducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % showcaseSlides.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPageVisible, isRotationPaused, prefersReducedMotion]);

  const activeSlide = showcaseSlides[activeIndex] ?? showcaseSlides[0];

  return (
    <section
      className="home-featured-showcase"
      aria-label="Öne çıkan ikinci el bebek ürünleri"
      onBlurCapture={() => setIsRotationPaused(false)}
      onFocusCapture={() => setIsRotationPaused(true)}
      onMouseEnter={() => setIsRotationPaused(true)}
      onMouseLeave={() => setIsRotationPaused(false)}
    >
      <div className="home-featured-showcase-image">
        <Image
          alt={activeSlide.alt}
          height={941}
          priority={activeIndex === 0}
          sizes="(max-width: 768px) 100vw, 50vw"
          src={activeSlide.src}
          width={1672}
        />
      </div>

      <div className="home-featured-showcase-content">
        <p className="eyebrow">Seçkin ikinci el ürünler</p>
        <h1>Özenle seçilmiş, çok sevilen ürünler</h1>
        <p>
          Temiz, güvenli ve çok iyi durumda ikinci el bebek ürünleri. Bütçenizi
          korurken dünyaya da iyi gelin.
        </p>

        <div className="home-featured-benefits" aria-label="Ürün avantajları">
          <span>Güvenli</span>
          <span>Temiz</span>
          <span>Ekonomik</span>
          <span>Sürdürülebilir</span>
        </div>

        <div className="home-featured-actions">
          <button type="button" onClick={scrollToLatestListings}>
            Alışverişe başla
          </button>
          <Link href="/sell" className="secondary">İlan oluştur</Link>
        </div>

        <div className="home-featured-dots" aria-label="Görsel sırası">
          {showcaseSlides.map((slide, index) => (
            <button
              aria-label={`${index + 1}. görseli göster`}
              aria-pressed={activeIndex === index}
              className={activeIndex === index ? "active" : ""}
              key={slide.src}
              type="button"
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
