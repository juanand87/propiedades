'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, CheckCircle, AlertCircle, ExternalLink, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CustomDomainInfo {
  subdomain: string;
  customDomain: string | null;
  verified: boolean;
  verifiedAt: string | null;
}

export default function CustomDomainSection() {
  const { user } = useAuth();
  const [domainInfo, setDomainInfo] = useState<CustomDomainInfo | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (user?.vendorId) {
      loadDomainInfo();
    }
  }, [user]);

  const loadDomainInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/vendors/${user?.vendorId}/custom-domain`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDomainInfo(data);
        setCustomDomain(data.customDomain || '');
      }
    } catch (error) {
      console.error('Error loading domain info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/vendors/${user?.vendorId}/custom-domain`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ customDomain }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        await loadDomainInfo();
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al guardar el dominio' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar el dominio personalizado' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/vendors/${user?.vendorId}/verify-custom-domain`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await loadDomainInfo();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al verificar el dominio' });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Dominio Personalizado</h2>
        <p className="text-muted-foreground">
          Configura un dominio personalizado para tu tienda
        </p>
      </div>

      {/* Current Subdomain */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Globe className="w-5 h-5 text-purple-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Dominio actual</h3>
            <div className="flex items-center gap-2">
              <a 
                href={`https://${domainInfo?.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline flex items-center gap-1"
              >
                {domainInfo?.subdomain}
                <ExternalLink className="w-4 h-4" />
              </a>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Activo</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Custom Domain Configuration */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="customDomain">Dominio Personalizado</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Ingresa tu dominio propio (ej: tutienda.com)
            </p>
            <Input
              id="customDomain"
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="tutienda.com"
              disabled={saving || verifying}
            />
          </div>

          {domainInfo?.customDomain && (
            <div className={`flex items-start gap-2 p-3 rounded-lg ${
              domainInfo.verified 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              {domainInfo.verified ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Dominio verificado</p>
                    <p className="text-sm text-green-700">
                      Tu dominio está configurado correctamente y funcionando
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900">Pendiente de verificación</p>
                    <p className="text-sm text-yellow-700">
                      Configura el DNS y luego verifica tu dominio
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || verifying || !customDomain.trim()}
            >
              {saving ? 'Guardando...' : 'Guardar Dominio'}
            </Button>
            
            {domainInfo?.customDomain && !domainInfo.verified && (
              <Button
                onClick={handleVerify}
                variant="outline"
                disabled={saving || verifying}
              >
                {verifying ? 'Verificando...' : 'Verificar Dominio'}
              </Button>
            )}
          </div>

          {message && (
            <div className={`flex items-start gap-2 p-3 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : message.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              )}
              <p className={`text-sm ${
                message.type === 'success' ? 'text-green-700' :
                message.type === 'error' ? 'text-red-700' :
                'text-blue-700'
              }`}>
                {message.text}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* DNS Instructions */}
      {customDomain && !domainInfo?.verified && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Configuración DNS</h3>
              <p className="text-sm text-blue-800 mb-3">
                Para que tu dominio personalizado funcione, debes configurar estos registros DNS en tu proveedor de dominios:
              </p>
              
              <div className="bg-white rounded-lg p-4 border border-blue-200 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Registro CNAME</p>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-gray-500">Nombre:</span> @
                      </div>
                      <div>
                        <span className="text-gray-500">Tipo:</span> CNAME
                      </div>
                      <div>
                        <span className="text-gray-500">Valor:</span> mundobeat.cl
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Registro CNAME para www</p>
                  <div className="font-mono text-sm bg-gray-50 p-2 rounded">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-gray-500">Nombre:</span> www
                      </div>
                      <div>
                        <span className="text-gray-500">Tipo:</span> CNAME
                      </div>
                      <div>
                        <span className="text-gray-500">Valor:</span> mundobeat.cl
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-blue-700 mt-3">
                Los cambios DNS pueden tomar entre 5 minutos y 48 horas en propagarse. Una vez configurado, haz clic en "Verificar Dominio".
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
