"use client";

import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    // Detectar por User Agent
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // Detectar por ancho de pantalla
    const isMobileWidth = window.innerWidth < 1024;
    
    // Es móvil si cumple cualquiera de las dos condiciones
    const result = isMobileUA || isMobileWidth;
    setIsMobile(result);
  }, []);

  return isMobile;
}
