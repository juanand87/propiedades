"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { assetUrl } from "@/lib/estate-api";
import styles from "./PropertyCardGallery.module.css";

export function PropertyCardGallery({
  images,
  title,
  href,
  label,
  featured,
}: {
  images: { id?: string; url: string; alt_text?: string }[];
  title: string;
  href: string;
  label: string;
  featured: boolean;
}) {
  const photos = images.length
    ? images
    : [{ url: "/architecture.svg", alt_text: title }];
  const [active, setActive] = useState(0);
  const [loadedThrough, setLoadedThrough] = useState(1);
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  function go(index: number) {
    const element = track.current;
    if (!element) return;
    const next = Math.max(0, Math.min(photos.length - 1, index));
    setLoadedThrough((previous) => Math.max(previous, next + 1));
    element.scrollTo({
      left: next * element.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <div
      className={`property-image ${styles.gallery}`}
      role="region"
      aria-roledescription="carrusel"
      aria-label={`Fotografías de ${title}`}
    >
      <div
        ref={track}
        className={styles.track}
        tabIndex={photos.length > 1 ? 0 : -1}
        onScroll={(event) => {
          const element = event.currentTarget;
          const index = Math.max(
            0,
            Math.min(
              photos.length - 1,
              Math.round(element.scrollLeft / Math.max(1, element.clientWidth)),
            ),
          );
          setActive(index);
          setLoadedThrough((previous) => Math.max(previous, index + 1));
        }}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            go(active + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
        onPointerDownCapture={(event) => {
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            moved: false,
          };
        }}
        onPointerMoveCapture={(event) => {
          const start = gesture.current;
          if (
            start &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
          )
            start.moved = true;
        }}
        onPointerCancel={() => {
          if (gesture.current) gesture.current.moved = true;
        }}
        onClickCapture={(event) => {
          // Scrolling a photo must never open the listing through a trailing tap.
          if (event.detail !== 0 && gesture.current?.moved) {
            event.preventDefault();
            event.stopPropagation();
          }
          gesture.current = null;
        }}
      >
        {photos.map((image, index) => (
          <Link
            className={styles.slide}
            key={image.id || image.url || index}
            href={href}
            tabIndex={index === active ? 0 : -1}
            aria-label={`Ver ${title}, fotografía ${index + 1} de ${photos.length}`}
            draggable={false}
          >
            <img
              src={index <= loadedThrough ? assetUrl(image.url) : undefined}
              alt={image.alt_text || `${title}, fotografía ${index + 1}`}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </Link>
        ))}
      </div>
      <span className={`image-label ${styles.label}`}>{label}</span>
      {featured && (
        <span className={`featured-label ${styles.label}`}>Destacada</span>
      )}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.previous}`}
            disabled={active === 0}
            onClick={() => go(active - 1)}
            aria-label={`Fotografía anterior de ${title}`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            disabled={active === photos.length - 1}
            onClick={() => go(active + 1)}
            aria-label={`Fotografía siguiente de ${title}`}
          >
            <ChevronRight size={20} />
          </button>
          <span
            className={styles.counter}
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={styles.srOnly}>Fotografía </span>
            {active + 1}
            <span aria-hidden="true"> / </span>
            <span className={styles.srOnly}> de </span>
            {photos.length}
          </span>
        </>
      )}
    </div>
  );
}
