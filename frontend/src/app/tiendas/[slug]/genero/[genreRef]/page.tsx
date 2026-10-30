"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getProductsUrl } from "@/lib/useCustomDomain";

export default function StoreGenreRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const genreRef = params.genreRef as string;

  useEffect(() => {
    const redirectToProducts = async () => {
      try {
        let genreId = "";

        // If the path already has an ID, use it directly.
        if (/^\d+$/.test(genreRef)) {
          genreId = genreRef;
        } else {
          const genresData = await api.getGenres();
          const genres = Array.isArray(genresData) ? genresData : (genresData.genres || []);
          const foundGenre = genres.find((g: any) => g.slug === genreRef);
          if (foundGenre?.id) {
            genreId = String(foundGenre.id);
          }
        }

        const targetUrl = genreId
          ? getProductsUrl(slug, { genreId })
          : getProductsUrl(slug);

        router.replace(targetUrl);
      } catch {
        router.replace(getProductsUrl(slug));
      }
    };

    if (slug && genreRef) {
      redirectToProducts();
    }
  }, [slug, genreRef, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-sm text-gray-600">Redirigiendo al catalogo...</p>
    </div>
  );
}
