'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface SmtpSettings {
  id?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpFromName: string;
}

export default function SmtpConfigSection() {
  const [settings, setSettings] = useState<SmtpSettings>({
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpFromName: 'MundoBeat Marketplace',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL}/admin/smtp-settings`;
      console.log('Loading settings from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Settings loaded:', data);
        setSettings({
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort || 587,
          smtpSecure: data.smtpSecure || false,
          smtpUser: data.smtpUser || '',
          smtpPassword: data.smtpPassword || '',
          smtpFromEmail: data.smtpFromEmail || '',
          smtpFromName: data.smtpFromName || 'MundoBeat Marketplace',
        });
      } else {
        console.error('Failed to load settings:', response.status);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    console.log('Saving settings:', settings);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/smtp-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      console.log('Save response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Settings saved:', data);
        setMessage({ type: 'success', text: 'Configuración SMTP guardada exitosamente' });
        // Reload settings to show updated data
        await loadSettings();
      } else {
        const errorData = await response.json();
        console.error('Error saving settings:', errorData);
        console.error('Error details:', JSON.stringify(errorData, null, 2));
        setMessage({ type: 'error', text: `Error al guardar: ${errorData.message || 'Error desconocido'}` });
      }
    } catch (error) {
      console.error('Exception saving settings:', error);
      setMessage({ type: 'error', text: 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/smtp-settings/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al probar la conexión SMTP' });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Por favor ingresa un email para la prueba' });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/smtp-settings/send-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email: testEmail }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al enviar el email de prueba' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p>Cargando configuración...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Configuración SMTP</h3>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Esta configuración se usará para enviar emails del sistema, como credenciales de nuevos vendedores.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="col-span-2">
            <Label htmlFor="smtpHost">Servidor SMTP</Label>
            <Input
              id="smtpHost"
              value={settings.smtpHost}
              onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <Label htmlFor="smtpPort">Puerto</Label>
            <Input
              id="smtpPort"
              type="number"
              value={settings.smtpPort}
              onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
            />
          </div>

          <div className="flex items-center gap-2 pt-7">
            <input
              type="checkbox"
              id="smtpSecure"
              checked={settings.smtpSecure}
              onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="smtpSecure">Conexión Segura (SSL/TLS)</Label>
          </div>

          <div className="col-span-2">
            <Label htmlFor="smtpUser">Usuario SMTP</Label>
            <Input
              id="smtpUser"
              value={settings.smtpUser}
              onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
              placeholder="usuario@gmail.com"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="smtpPassword">Contraseña SMTP</Label>
            <Input
              id="smtpPassword"
              type="password"
              value={settings.smtpPassword}
              onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              placeholder="Contraseña o App Password"
            />
            <p className="text-xs text-gray-500 mt-1">
              Para Gmail, usa una "Contraseña de aplicación" en lugar de tu contraseña normal
            </p>
          </div>

          <div className="col-span-2">
            <Label htmlFor="smtpFromEmail">Email Remitente</Label>
            <Input
              id="smtpFromEmail"
              type="email"
              value={settings.smtpFromEmail}
              onChange={(e) => setSettings({ ...settings, smtpFromEmail: e.target.value })}
              placeholder="noreply@mundobeat.cl"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="smtpFromName">Nombre Remitente</Label>
            <Input
              id="smtpFromName"
              value={settings.smtpFromName}
              onChange={(e) => setSettings({ ...settings, smtpFromName: e.target.value })}
              placeholder="MundoBeat Marketplace"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
          
          <Button 
            onClick={handleTestConnection}
            disabled={testing}
            variant="outline"
          >
            {testing ? 'Probando...' : 'Probar Conexión'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="font-semibold mb-4">Enviar Email de Prueba</h4>
        <div className="flex gap-3">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="flex-1"
          />
          <Button 
            onClick={handleSendTest}
            disabled={testing}
            variant="outline"
          >
            {testing ? 'Enviando...' : 'Enviar Prueba'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
