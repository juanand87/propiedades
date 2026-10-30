"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import MediaLibrary from "@/components/admin/MediaLibrary";

export default function BibliotecaDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.vendorId) {
      setLoading(false);
    }
  }, [user]);

  if (loading || !user?.vendorId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando biblioteca...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Biblioteca de Medios</h1>
          <p className="text-slate-400 mt-1">Gestiona todas tus imágenes y archivos</p>
        </div>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <MediaLibrary 
            vendorId={user.vendorId} 
            mode="manage"
            accept="image/*,video/*,application/pdf,.pdf,.xlsx,.xls,.csv"
          />
        </CardContent>
      </Card>
    </div>
  );
}
