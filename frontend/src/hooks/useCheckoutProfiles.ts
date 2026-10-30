import { useState, useEffect } from 'react';

export interface CheckoutProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  rut: string;
  address: string;
  number: string;
  regionId: number | null;
  regionName: string;
  communeId: number | null;
  communeName: string;
  notes: string;
  timestamp: number;
}

const STORAGE_KEY = 'checkout_profiles';
const MAX_PROFILES = 10;
const MAX_AGE_DAYS = 90; // Mantener perfiles por 90 días

export function useCheckoutProfiles() {
  const [profiles, setProfiles] = useState<CheckoutProfile[]>([]);

  // Cargar perfiles del localStorage al montar
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CheckoutProfile[] = JSON.parse(stored);
        
        // Filtrar perfiles antiguos
        const now = Date.now();
        const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        const validProfiles = parsed.filter(p => now - p.timestamp < maxAge);
        
        // Ordenar por más reciente
        validProfiles.sort((a, b) => b.timestamp - a.timestamp);
        
        // Limitar cantidad
        const limitedProfiles = validProfiles.slice(0, MAX_PROFILES);
        
        setProfiles(limitedProfiles);
        
        // Si se eliminaron perfiles, actualizar localStorage
        if (limitedProfiles.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedProfiles));
        }
      }
    } catch (error) {
      console.error('Error loading checkout profiles:', error);
    }
  };

  const saveProfile = (profile: Omit<CheckoutProfile, 'id' | 'timestamp'>) => {
    try {
      // Verificar si ya existe un perfil con el mismo nombre y email
      const existingIndex = profiles.findIndex(
        p => p.name.toLowerCase() === profile.name.toLowerCase() && 
             p.email.toLowerCase() === profile.email.toLowerCase()
      );

      const newProfile: CheckoutProfile = {
        ...profile,
        id: existingIndex >= 0 ? profiles[existingIndex].id : Date.now().toString(),
        timestamp: Date.now(),
      };

      let updatedProfiles: CheckoutProfile[];
      
      if (existingIndex >= 0) {
        // Actualizar perfil existente
        updatedProfiles = [...profiles];
        updatedProfiles[existingIndex] = newProfile;
      } else {
        // Agregar nuevo perfil al inicio
        updatedProfiles = [newProfile, ...profiles].slice(0, MAX_PROFILES);
      }

      setProfiles(updatedProfiles);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfiles));
      
      return newProfile;
    } catch (error) {
      console.error('Error saving checkout profile:', error);
      return null;
    }
  };

  const deleteProfile = (id: string) => {
    try {
      const updatedProfiles = profiles.filter(p => p.id !== id);
      setProfiles(updatedProfiles);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfiles));
    } catch (error) {
      console.error('Error deleting checkout profile:', error);
    }
  };

  const getProfileByName = (name: string): CheckoutProfile | undefined => {
    return profiles.find(p => p.name.toLowerCase() === name.toLowerCase());
  };

  const searchProfiles = (query: string): CheckoutProfile[] => {
    if (!query.trim()) return profiles;
    
    const lowerQuery = query.toLowerCase();
    return profiles.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.email.toLowerCase().includes(lowerQuery)
    );
  };

  const clearAllProfiles = () => {
    try {
      setProfiles([]);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing checkout profiles:', error);
    }
  };

  return {
    profiles,
    saveProfile,
    deleteProfile,
    getProfileByName,
    searchProfiles,
    clearAllProfiles,
    loadProfiles,
  };
}
