'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Truck, Settings, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface ShippingConfigProps {
  vendorId: string;
  methodCode: 'bluex';
  methodName: string;
  currentConfig: any;
  onSave: () => void;
  onCancel: () => void;
}

export function ShippingConfig({ vendorId, methodCode, methodName, currentConfig, onSave, onCancel }: ShippingConfigProps) {
  const [activeTab, setActiveTab] = useState<'connection' | 'store' | 'summary'>('connection');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);

  // BlueExpress Config
  const [bluexConfig, setBluexConfig] = useState({
    integrationId: currentConfig?.apiKey || '',
    bxToken: currentConfig?.integrationToken || '',
    wooClientKey: currentConfig?.wooClientKey || '',
    wooClientSecret: currentConfig?.wooClientSecret || '',
    originRegionId: currentConfig?.originRegionId || '',
    originCommune: currentConfig?.originCommune || '',
    orderStatus: currentConfig?.orderStatus || 'processing',
    pudoEnabled: currentConfig?.pudoEnabled || false,
  });

  useEffect(() => {
    loadRegionsAndCommunes();
  }, []);

  const loadRegionsAndCommunes = async () => {
    try {
      const [regionsRes, communesRes] = await Promise.all([
        api.getRegions(),
        api.getAllCommunes()
      ]);
      setRegions(regionsRes);
      setCommunes(communesRes);
    } catch (error) {
      console.error('Error loading regions/communes:', error);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      if (methodCode === 'bluex') {
        if (!bluexConfig.integrationId) {
          setTestResult({
            success: false,
            message: 'Por favor ingresa el ID de integración'
          });
          return;
        }

        // Llamar al endpoint de prueba de conexión
        const response = await fetch('http://localhost:3001/api/shipping/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            methodCode: 'bluex',
            config: bluexConfig,
          }),
        });

        const result = await response.json();
        setTestResult({
          success: result.success,
          message: result.message,
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Error al probar la conexión'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      let config: any = {};

      if (methodCode === 'bluex') {
        config = {
          apiKey: bluexConfig.integrationId,
          integrationToken: bluexConfig.bxToken,
          wooClientKey: bluexConfig.wooClientKey,
          wooClientSecret: bluexConfig.wooClientSecret,
          baseUrl: 'https://apigw.bluex.cl',
          accountName: 'Viniloteca', // O extraerlo de los datos
          sandboxMode: false,
          serviceType: 'NORMAL',
          familiaProducto: 'PAQU',
          originCommune: bluexConfig.originCommune,
          originRegionId: bluexConfig.originRegionId,
          orderStatus: bluexConfig.orderStatus,
          pudoEnabled: bluexConfig.pudoEnabled,
          originRegion: regions.find(r => r.id === parseInt(bluexConfig.originRegionId))?.name || 'Región Metropolitana',
        };
      }

      // Obtener el ID del método de envío
      const methods = await api.getShippingMethods();
      const method = methods.find((m: any) => m.code === methodCode);

      if (!method) {
        throw new Error('MÃ©todo de envÃ­o no encontrado');
      }

      // Activar o actualizar el mÃ©todo
      await api.enableShippingMethod(vendorId, method.id, config);

      // Configurar todas las comunas como disponibles
      const vendorMethods = await api.getVendorShippingMethods(vendorId);
      const newVendorMethod = vendorMethods.find((vm: any) => vm.shippingMethodId === method.id);

      // Método habilitado exitosamente, no necesitamos configurar comunas por ahora
      console.log('✅ BlueExpress method enabled successfully:', newVendorMethod);

      alert(`${methodName} configurado correctamente`);
      onSave();
    } catch (error: any) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuraciÃ³n: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderBlueXConnection = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="integrationId">ID de IntegraciÃ³n *</Label>
        <Input
          id="integrationId"
          type="text"
          value={bluexConfig.integrationId}
          onChange={(e) => setBluexConfig({ ...bluexConfig, integrationId: e.target.value })}
          placeholder="Ingresa el ID de integraciÃ³n de Blue Express"
        />
        <p className="text-xs text-gray-500 mt-1">
          Ingresa el ID de integración que obtuviste en el portal Ecommerce de Blue Express
        </p>
      </div>

      <div>
        <Label htmlFor="bxToken">Token de BlueExpress (BX-TOKEN) *</Label>
        <Input
          id="bxToken"
          type="text"
          value={bluexConfig.bxToken}
          onChange={(e) => setBluexConfig({ ...bluexConfig, bxToken: e.target.value })}
          placeholder="Ingresa tu token de BlueExpress"
        />
        <p className="text-xs text-gray-500 mt-1">
          Este es el campo "Administrative Token" de tu configuración de BlueExpress en WordPress
        </p>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">Credenciales de WooCommerce (Opcional)</h3>
        <p className="text-sm text-gray-600 mb-3">
          Si ya tienes WooCommerce, puedes conectar estas credenciales
        </p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="wooClientKey">Clave del cliente</Label>
            <Input
              id="wooClientKey"
              type="text"
              value={bluexConfig.wooClientKey}
              onChange={(e) => setBluexConfig({ ...bluexConfig, wooClientKey: e.target.value })}
              placeholder="ck_..."
            />
          </div>

          <div>
            <Label htmlFor="wooClientSecret">Clave secreta de cliente</Label>
            <Input
              id="wooClientSecret"
              type="password"
              value={bluexConfig.wooClientSecret}
              onChange={(e) => setBluexConfig({ ...bluexConfig, wooClientSecret: e.target.value })}
              placeholder="cs_..."
            />
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleTestConnection}
        disabled={testing || !bluexConfig.integrationId || !bluexConfig.bxToken}
        className="w-full"
      >
        {testing ? 'Probando...' : 'Probar Conexión'}
      </Button>

      {testResult && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {testResult.success ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm">{testResult.message}</span>
        </div>
      )}
    </div>
  );

  const renderStoreConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="originRegion">RegiÃ³n de origen *</Label>
          <select
            id="originRegion"
            value={bluexConfig.originRegionId}
            onChange={(e) => {
              setBluexConfig({ ...bluexConfig, originRegionId: e.target.value });
            }}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Selecciona una regiÃ³n</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
        </div>

        <div>
          <Label htmlFor="originCommune">Comuna de origen *</Label>
          {methodCode === 'bluex' && bluexConfig.originRegionId ? (
            <select
              id="originCommune"
              value={bluexConfig.originCommune}
              onChange={(e) => setBluexConfig({ ...bluexConfig, originCommune: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Selecciona una comuna</option>
              {communes
                .filter((c) => c.regionId === parseInt(bluexConfig.originRegionId))
                .map((commune) => (
                  <option key={commune.id} value={commune.name}>
                    {commune.name}
                  </option>
                ))}
            </select>
          ) : (
            <Input
              id="originCommune"
              type="text"
              value={bluexConfig.originCommune}
              onChange={(e) => setBluexConfig({ ...bluexConfig, originCommune: e.target.value })}
              placeholder="Comuna desde donde envÃ­as"
            />
          )}
        </div>

        {methodCode === 'bluex' && (
          <>
            <div>
              <Label htmlFor="orderStatus">Estado para crear orden en Ecommerce Blue Express</Label>
              <select
                id="orderStatus"
                value={bluexConfig.orderStatus}
                onChange={(e) => setBluexConfig({ ...bluexConfig, orderStatus: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="processing">Procesando</option>
                <option value="completed">Completado</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pudoEnabled"
                checked={bluexConfig.pudoEnabled}
                onChange={(e) => setBluexConfig({ ...bluexConfig, pudoEnabled: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="pudoEnabled" className="cursor-pointer">
                Â¿Habilitar Puntos de retiro Blue Express (PUDO)?
              </Label>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderSummary = () => {
    const config = bluexConfig;
    const connectionStatus = testResult?.success || false;

    return (
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Resumen de la configuraciÃ³n</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">ID de Integración:</span>
              <span className="font-medium">{bluexConfig.integrationId || 'No configurado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Región de origen:</span>
              <span className="font-medium">
                {regions.find(r => r.id === parseInt(bluexConfig.originRegionId))?.name || 'No seleccionada'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Comuna de origen:</span>
              <span className="font-medium">{bluexConfig.originCommune || 'No configurada'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estado para crear orden:</span>
              <span className="font-medium capitalize">{bluexConfig.orderStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Puntos de retiro Blue Express:</span>
              <span className="font-medium">{bluexConfig.pudoEnabled ? 'Sí' : 'No'}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Estado de la conexiÃ³n</h3>
          <div className={`flex items-center gap-2 ${
            connectionStatus ? 'text-green-600' : 'text-gray-500'
          }`}>
            {connectionStatus ? (
              <>
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Conectado</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">No probado</span>
              </>
            )}
          </div>
          {!connectionStatus && (
            <p className="text-xs text-gray-500 mt-2">
              Ve a la pestaÃ±a "ConexiÃ³n" y prueba la conexiÃ³n antes de guardar
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Configurar {methodName}
        </CardTitle>
        <CardDescription>
          Configura las credenciales y parÃ¡metros para {methodName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('connection')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'connection'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              ConexiÃ³n
            </div>
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'store'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Configura tu tienda
            </div>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'summary'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Resumen
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mb-6">
          {activeTab === 'connection' && renderBlueXConnection()}
          {activeTab === 'store' && renderStoreConfig()}
          {activeTab === 'summary' && renderSummary()}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Guardando...' : 'Guardar ConfiguraciÃ³n'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

