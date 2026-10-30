"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MediaLibrary from "@/components/admin/MediaLibrary";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function BibliotecaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Biblioteca de Medios</h1>
          <p className="text-gray-600 mt-1">Gestiona todas las imágenes y archivos del marketplace</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <MediaLibrary 
            vendorId={MARKETPLACE_VENDOR_ID} 
            mode="manage"
            accept="image/*,video/*"
          />
        </CardContent>
      </Card>
    </div>
  );
}
