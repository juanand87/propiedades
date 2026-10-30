import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DiscogsSearchParams {
  query?: string;
  format?: string;
  artist?: string;
  release_title?: string;
  label?: string;
  catno?: string;
  barcode?: string;
  per_page?: number;
  page?: number;
}

export interface DiscogsSearchResult {
  id: number;
  type: string;
  title: string;
  year?: string;
  format?: string[];
  label?: string[];
  country?: string;
  genre?: string[];
  style?: string[];
  thumb?: string;
  cover_image?: string;
  catno?: string;
  barcode?: string[];
}

@Injectable()
export class DiscogsService {
  private readonly baseUrl = 'https://api.discogs.com';

  constructor(private configService: ConfigService) {}

  async search(apiKey: string, params: DiscogsSearchParams): Promise<any> {
    if (!apiKey) {
      throw new HttpException('Discogs API key not configured', HttpStatus.BAD_REQUEST);
    }

    const searchParams = new URLSearchParams();
    
    // Construir query combinado
    const queryParts: string[] = [];
    if (params.artist) queryParts.push(params.artist);
    if (params.release_title) queryParts.push(params.release_title);
    if (params.label) queryParts.push(params.label);
    if (params.format) searchParams.append('format', params.format);
    if (params.catno) searchParams.append('catno', params.catno);
    if (params.barcode) searchParams.append('barcode', params.barcode);
    
    if (queryParts.length > 0) {
      searchParams.append('q', queryParts.join(' '));
    } else if (params.query) {
      searchParams.append('q', params.query);
    }

    searchParams.append('type', 'release');
    const perPage = 100; // Máximo por página
    searchParams.append('per_page', String(perPage));
    searchParams.append('page', '1');

    const url = `${this.baseUrl}/database/search?${searchParams.toString()}`;

    try {
      // Primera llamada para obtener el total
      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs token=${apiKey}`,
          'User-Agent': 'MusicMarketplace/1.0',
        },
      });

      if (!response.ok) {
        throw new HttpException(
          `Discogs API error: ${response.statusText}`,
          response.status,
        );
      }

      const firstPageData = await response.json();
      const totalResults = firstPageData.pagination?.items || 0;
      const totalPages = Math.min(
        Math.ceil(totalResults / perPage),
        5 // Límite de 5 páginas (500 resultados) para no saturar
      );

      // Si solo hay una página, retornar directamente
      if (totalPages <= 1) {
        return firstPageData;
      }

      // Obtener todas las páginas en paralelo
      const allResults = [firstPageData.results];
      const pagePromises: Promise<any>[] = [];

      for (let page = 2; page <= totalPages; page++) {
        const pageSearchParams = new URLSearchParams(searchParams);
        pageSearchParams.set('page', String(page));
        const pageUrl = `${this.baseUrl}/database/search?${pageSearchParams.toString()}`;

        pagePromises.push(
          fetch(pageUrl, {
            headers: {
              'Authorization': `Discogs token=${apiKey}`,
              'User-Agent': 'MusicMarketplace/1.0',
            },
          }).then(res => res.json())
        );
      }

      const additionalPages = await Promise.all(pagePromises);
      additionalPages.forEach((pageData: any) => {
        if (pageData.results) {
          allResults.push(pageData.results);
        }
      });

      // Combinar todos los resultados
      const data = {
        ...firstPageData,
        results: allResults.flat(),
        pagination: {
          ...firstPageData.pagination,
          items: allResults.flat().length,
        }
      };

      return data;
    } catch (error) {
      console.error('Discogs search error:', error);
      throw new HttpException(
        `Error connecting to Discogs API: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getRelease(apiKey: string, releaseId: string): Promise<any> {
    if (!apiKey) {
      throw new HttpException('Discogs API key not configured', HttpStatus.BAD_REQUEST);
    }

    const url = `${this.baseUrl}/releases/${releaseId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs token=${apiKey}`,
          'User-Agent': 'MusicMarketplace/1.0',
        },
      });

      if (!response.ok) {
        throw new HttpException(
          `Discogs API error: ${response.statusText}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Discogs getRelease error:', error);
      throw new HttpException(
        `Error connecting to Discogs API: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getArtist(apiKey: string, artistId: string): Promise<any> {
    if (!apiKey) {
      throw new HttpException('Discogs API key not configured', HttpStatus.BAD_REQUEST);
    }

    const url = `${this.baseUrl}/artists/${artistId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs token=${apiKey}`,
          'User-Agent': 'MusicMarketplace/1.0',
        },
      });

      if (!response.ok) {
        throw new HttpException(
          `Discogs API error: ${response.statusText}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Discogs getArtist error:', error);
      throw new HttpException(
        `Error connecting to Discogs API: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
