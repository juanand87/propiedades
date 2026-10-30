'use client';

import { useState, useEffect } from 'react';
import { api, API_URL } from '@/lib/api';
import { colorThemes } from '@/lib/colorThemes';
import { Check, ChevronRight, ChevronLeft, Upload, X, Store, Palette, Image, Share2, Rocket, Lock } from 'lucide-react';

interface OnboardingWizardProps {
  vendorId: string;
  storeName: string;
  storeSlug: string;
  onComplete: () => void;
}

const TOTAL_STEPS = 6;

export default function OnboardingWizard({ vendorId, storeName, storeSlug, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Password + Description
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [description, setDescription] = useState('');
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [needsPasswordChange, setNeedsPasswordChange] = useState(true);

  // Step 2: Logo
  const [logo, setLogo] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Step 3: Color Theme  
  const [selectedTheme, setSelectedTheme] = useState('default');

  // Step 4: Slides  
  const [useDefaultSlides, setUseDefaultSlides] = useState(true);
  const [customSlideUrls, setCustomSlideUrls] = useState<string[]>([]);
  const [uploadingSlides, setUploadingSlides] = useState(false);

  // Step 5: Social Media
  const [social, setSocial] = useState({
    instagram: '',
    facebook: '',
    whatsapp: '',
    twitter: '',
  });

  useEffect(() => {
    checkPasswordStatus();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const allCategories = await api.getCategories();

      const normalizedCategories = (Array.isArray(allCategories) ? allCategories : [])
        .filter((cat: any) => cat && cat.isActive !== false)
        .map((cat: any) => ({ id: String(cat.id), name: cat.name }));

      setAvailableCategories(normalizedCategories);
      // Start with no category selected; user must choose intentionally.
      setSelectedCategoryIds([]);
    } catch (error) {
      console.error('Error loading categories:', error);
      setAvailableCategories([]);
      setSelectedCategoryIds([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const saveCategorySelection = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const selectedSet = new Set(selectedCategoryIds);

    await Promise.all(
      availableCategories.map(async (category: any, index: number) => {
        const isSelected = selectedSet.has(category.id);
        const endpoint = `${API_URL}/vendors/${vendorId}/categories/${category.id}/${isSelected ? 'enable' : 'disable'}`;

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: isSelected ? JSON.stringify({ displayOrder: index }) : undefined,
          });

          if (!response.ok) {
            console.warn('Category update failed:', category.id, response.status);
          }
        } catch (error) {
          console.warn('Category update error:', category.id, error);
        }
      }),
    );
  };

  const checkPasswordStatus = async () => {
    try {
      const profile = await api.getProfile();
      setNeedsPasswordChange(!!profile.requirePasswordChange);
      if (!profile.requirePasswordChange) {
        setPasswordChanged(true);
      }
    } catch (error) {
      console.error('Error checking password status:', error);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        setPasswordChanged(true);
        setNeedsPasswordChange(false);
      } else {
        const data = await response.json();
        setPasswordError(data.message || 'Error al cambiar la contraseña');
      }
    } catch {
      setPasswordError('Error al conectar con el servidor');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('files', file);

      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/vendors/${vendorId}/upload-files`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) throw new Error('Error al subir el logo');
      const data = await response.json();
      setLogo(data.urls[0]);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Error al subir el logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSlidesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingSlides(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      Array.from(files).slice(0, 5).forEach((file) => formData.append('files', file));

      const response = await fetch(`${API_URL}/vendors/${vendorId}/upload-files`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir slides');
      }

      const data = await response.json();
      const urls = Array.isArray(data.urls) ? data.urls : [];
      setCustomSlideUrls(urls);
      if (urls.length > 0) {
        setUseDefaultSlides(false);
      }
    } catch (error) {
      console.error('Error uploading slides:', error);
      alert('No se pudieron subir los slides');
    } finally {
      setUploadingSlides(false);
    }
  };

  const syncHomepageSliderBlock = async (sliderId: string) => {
    if (!sliderId) return;

    try {
      const homepage = await api.getHomepage(storeSlug);
      if (!homepage?.id || !Array.isArray(homepage.blocks)) return;

      const updatedBlocks = homepage.blocks.map((block: any) => {
        if (block?.type === 'slides') {
          return { ...block, sliderId: String(sliderId) };
        }
        return block;
      });

      await api.updatePage(homepage.id, {
        blocks: updatedBlocks,
        rowsConfig: homepage.rowsConfig,
      });
    } catch (error) {
      console.warn('No se pudo sincronizar el slider en la homepage automáticamente:', error);
    }
  };

  const saveStep = async (step: number) => {
    setSaving(true);
    try {
      switch (step) {
        case 1: {
          // Save description to vendor
          if (description.trim()) {
            await api.updateVendor(vendorId, { description: description.trim() });
          }
          await saveCategorySelection();
          break;
        }
        case 2: {
          // Save logo
          const currentSettings = await api.getMyVendorSettings();
          const headerConfig = currentSettings.headerConfig || {};
          await api.updateMyVendorSettings({
            headerConfig: { ...headerConfig, logo },
          });
          break;
        }
        case 3: {
          // Save color theme
          await api.updateMyVendorSettings({ colorTheme: selectedTheme });
          break;
        }
        case 4: {
          if (customSlideUrls.length > 0) {
            const customSliderId = `slider-custom-${Date.now()}`;
            const customSlider = {
              id: customSliderId,
              name: 'Slider Portada',
              showInHomepage: true,
              order: 0,
              items: customSlideUrls.map((url, index) => ({
                id: `custom-slide-${index + 1}-${Date.now()}`,
                mediaType: 'image',
                imageUrl: url,
                title: `Slide ${index + 1}`,
                description: '',
                buttonText: '',
                buttonLink: '',
                order: index,
              })),
            };
            await api.updateMyVendorSettings({ slides: [customSlider] });
            await syncHomepageSliderBlock(customSliderId);
          } else if (!useDefaultSlides) {
            await api.updateMyVendorSettings({ slides: [] });
          } else {
            // Keep default slides and ensure homepage block points to the active slider.
            const currentSettings = await api.getMyVendorSettings();
            const activeSliderId = currentSettings?.slides?.[0]?.id;
            if (activeSliderId) {
              await syncHomepageSliderBlock(String(activeSliderId));
            }
          }
          break;
        }
        case 5: {
          // Save social links to headerConfig
          const currentSettings = await api.getMyVendorSettings();
          const headerConfig = currentSettings.headerConfig || {};
          const socialLinks: Record<string, string> = {};
          if (social.instagram) socialLinks.instagram = social.instagram;
          if (social.facebook) socialLinks.facebook = social.facebook;
          if (social.whatsapp) socialLinks.whatsapp = social.whatsapp;
          if (social.twitter) socialLinks.twitter = social.twitter;
          await api.updateMyVendorSettings({
            headerConfig: { ...headerConfig, socialLinks },
          });
          break;
        }
      }
    } catch (error) {
      console.error(`Error saving step ${step}:`, error);
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    await saveStep(currentStep);
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const finishOnboarding = async () => {
    await saveStep(currentStep);
    setSaving(true);
    try {
      await api.updateMyVendorSettings({ onboardingCompleted: true });
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return passwordChanged && selectedCategoryIds.length > 0 && !loadingCategories;
      case 2:
        return true; // Logo is optional (shows store name)
      case 3:
        return true; // Theme always has a default
      default:
        return true;
    }
  };

  const stepLabels = [
    'Bienvenida',
    'Logo',
    'Colores',
    'Portada',
    'Redes Sociales',
    'Resumen',
  ];

  const stepIcons = [Lock, Store, Palette, Image, Share2, Rocket];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h1 className="text-slate-900 font-bold text-lg">{storeName}</h1>
              <p className="text-slate-500 text-xs">Configuración inicial</p>
            </div>
          </div>
          <div className="text-slate-600 text-sm">
            Paso {currentStep} de {TOTAL_STEPS}
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {stepLabels.map((label, i) => {
              const StepIcon = stepIcons[i];
              const stepNum = i + 1;
              const isActive = stepNum === currentStep;
              const isDone = stepNum < currentStep;

              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      isDone ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-700 text-white ring-4 ring-blue-200' :
                      'bg-slate-200 text-slate-500'
                    }`}>
                      {isDone ? <Check className="w-5 h-5" /> : <StepIcon className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs mt-2 hidden sm:block transition-colors ${
                      isActive ? 'text-blue-700 font-semibold' : isDone ? 'text-green-600' : 'text-slate-400'
                    }`}>{label}</span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${
                      isDone ? 'bg-green-500' : 'bg-slate-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-32">
        <div className="max-w-2xl mx-auto">
          {currentStep === 1 && <Step1Welcome
            needsPasswordChange={needsPasswordChange}
            passwordChanged={passwordChanged}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            passwordError={passwordError}
            description={description}
            storeName={storeName}
            availableCategories={availableCategories}
            selectedCategoryIds={selectedCategoryIds}
            loadingCategories={loadingCategories}
            saving={saving}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onDescriptionChange={setDescription}
            onToggleCategory={toggleCategory}
            onChangePassword={handleChangePassword}
          />}

          {currentStep === 2 && <Step2Logo
            logo={logo}
            storeName={storeName}
            vendorId={vendorId}
            uploadingLogo={uploadingLogo}
            onLogoUpload={handleLogoUpload}
            onRemoveLogo={() => setLogo('')}
          />}

          {currentStep === 3 && <Step3Colors
            selectedTheme={selectedTheme}
            onSelectTheme={setSelectedTheme}
          />}

          {currentStep === 4 && <Step4Slides
            useDefaultSlides={useDefaultSlides}
            storeName={storeName}
            customSlideUrls={customSlideUrls}
            uploadingSlides={uploadingSlides}
            onToggleSlides={setUseDefaultSlides}
            onSlidesUpload={handleSlidesUpload}
            onRemoveCustomSlides={() => setCustomSlideUrls([])}
          />}

          {currentStep === 5 && <Step5Social
            social={social}
            onSocialChange={setSocial}
          />}

          {currentStep === 6 && <Step6Summary
            storeName={storeName}
            storeSlug={storeSlug}
            logo={logo}
            selectedTheme={selectedTheme}
            useDefaultSlides={useDefaultSlides}
            hasCustomSlides={customSlideUrls.length > 0}
            social={social}
          />}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Atrás
          </button>

          <div className="flex items-center gap-3">
            {/* Skip button for steps 4-5 */}
            {(currentStep === 4 || currentStep === 5) && (
              <button
                onClick={goNext}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 transition-colors text-sm"
              >
                Omitir
              </button>
            )}

            {currentStep < TOTAL_STEPS ? (
              <button
                onClick={goNext}
                disabled={!canProceed() || saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={finishOnboarding}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold disabled:opacity-40 transition-colors"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    ¡Lanzar mi tienda!
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================
// STEP 1: Welcome + Password + Description
// ==============================================
function Step1Welcome({
  needsPasswordChange,
  passwordChanged,
  newPassword,
  confirmPassword,
  passwordError,
  description,
  storeName,
  availableCategories,
  selectedCategoryIds,
  loadingCategories,
  saving,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onDescriptionChange,
  onToggleCategory,
  onChangePassword,
}: {
  needsPasswordChange: boolean;
  passwordChanged: boolean;
  newPassword: string;
  confirmPassword: string;
  passwordError: string;
  description: string;
  storeName: string;
  availableCategories: any[];
  selectedCategoryIds: string[];
  loadingCategories: boolean;
  saving: boolean;
  onNewPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onChangePassword: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">¡Bienvenido a {storeName}! 🎉</h2>
        <p className="text-slate-600 text-lg">
          Vamos a configurar tu tienda en unos simples pasos
        </p>
      </div>

      {/* Info about demo products */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <div className="flex gap-3">
          <span className="text-2xl">📦</span>
          <div>
            <h3 className="text-blue-800 font-semibold mb-1">Ya tienes 16 productos de ejemplo</h3>
            <p className="text-blue-700 text-sm">
              Hemos cargado productos de muestra del marketplace (con stock 0). Puedes editarlos o reemplazarlos con tus propios productos.
            </p>
          </div>
        </div>
      </div>

      {/* Category Selection */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-slate-900 font-semibold text-lg mb-2">¿Qué vas a vender?</h3>
        <p className="text-slate-600 text-sm mb-4">
          Selecciona las categorías que quieres activar en tu tienda (basadas en las categorías del marketplace).
        </p>

        {loadingCategories ? (
          <p className="text-sm text-slate-500">Cargando categorías...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableCategories.map((category) => {
              const selected = selectedCategoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onToggleCategory(category.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3">
          Debes seleccionar al menos una categoría para continuar.
        </p>
      </div>

      {/* Password Section */}
      {needsPasswordChange && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${passwordChanged ? 'bg-green-500' : 'bg-amber-500'}`}>
              {passwordChanged ? <Check className="w-4 h-4 text-white" /> : <Lock className="w-4 h-4 text-white" />}
            </div>
            <h3 className="text-slate-900 font-semibold text-lg">
              {passwordChanged ? '✅ Contraseña actualizada' : 'Establece tu contraseña'}
            </h3>
          </div>

          {!passwordChanged ? (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm mb-4">
                Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
              </p>
              <div>
                <label className="text-slate-700 text-sm font-medium block mb-1.5">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label className="text-slate-700 text-sm font-medium block mb-1.5">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Repite la contraseña"
                />
              </div>
              {passwordError && (
                <p className="text-red-400 text-sm">{passwordError}</p>
              )}
              <button
                onClick={onChangePassword}
                disabled={saving || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold disabled:opacity-40 transition-colors"
              >
                {saving ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </div>
          ) : (
            <p className="text-green-700 text-sm">Tu contraseña ha sido actualizada correctamente.</p>
          )}
        </div>
      )}

      {/* Description */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-slate-900 font-semibold text-lg mb-2">Describe tu tienda</h3>
        <p className="text-slate-600 text-sm mb-4">
          Una breve descripción que aparecerá en el perfil de tu tienda.
        </p>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={3}
          placeholder={`Ej: Tienda de vinilos, CDs y cassettes. Envíos a todo Chile.`}
          maxLength={300}
        />
        <p className="text-slate-500 text-xs mt-1 text-right">{description.length}/300</p>
      </div>
    </div>
  );
}

// ==============================================
// STEP 2: Logo Upload
// ==============================================
function Step2Logo({
  logo,
  storeName,
  vendorId,
  uploadingLogo,
  onLogoUpload,
  onRemoveLogo,
}: {
  logo: string;
  storeName: string;
  vendorId: string;
  uploadingLogo: boolean;
  onLogoUpload: (file: File) => void;
  onRemoveLogo: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Logo de tu tienda</h2>
        <p className="text-slate-600">
          Sube el logo que aparecerá en el header. Se recomienda PNG con fondo transparente.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        {/* Preview */}
        <div className="mb-6">
          <div className="w-full max-w-sm mx-auto h-32 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
            {logo ? (
              <img src={logo} alt="Logo" className="h-20 object-contain" />
            ) : (
              <div className="text-center">
                <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <span className="text-slate-500 text-sm">{storeName}</span>
              </div>
            )}
          </div>
          {!logo && (
            <p className="text-slate-500 text-xs mt-2">
              Si no subes un logo, se mostrará el nombre de tu tienda
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <label className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold cursor-pointer transition-colors ${
            uploadingLogo
              ? 'bg-slate-300 text-slate-500 cursor-wait'
              : 'bg-blue-700 hover:bg-blue-600 text-white'
          }`}>
            <Upload className="w-4 h-4" />
            {uploadingLogo ? 'Subiendo...' : 'Subir Logo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingLogo}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLogoUpload(file);
              }}
            />
          </label>
          {logo && (
            <button
              onClick={onRemoveLogo}
              className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==============================================
// STEP 3: Color Theme Selection
// ==============================================
function Step3Colors({
  selectedTheme,
  onSelectTheme,
}: {
  selectedTheme: string;
  onSelectTheme: (id: string) => void;
}) {
  const themes = Object.values(colorThemes);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Elige los colores de tu tienda</h2>
        <p className="text-slate-600">
          Selecciona un tema de colores. Podrás personalizarlos después.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onSelectTheme(theme.id)}
            className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
              selectedTheme === theme.id
                ? 'border-blue-600 ring-4 ring-blue-200 scale-[1.02]'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Color preview */}
            <div
              className="h-20"
              style={{ background: theme.preview }}
            />
            <div className="p-3 bg-white">
              <p className="text-slate-900 text-sm font-semibold">{theme.name}</p>
              <p className="text-slate-500 text-xs">{theme.description}</p>
            </div>
            {selectedTheme === theme.id && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==============================================
// STEP 4: Slides (Homepage slider)
// ==============================================
function Step4Slides({
  useDefaultSlides,
  storeName,
  customSlideUrls,
  uploadingSlides,
  onToggleSlides,
  onSlidesUpload,
  onRemoveCustomSlides,
}: {
  useDefaultSlides: boolean;
  storeName: string;
  customSlideUrls: string[];
  uploadingSlides: boolean;
  onToggleSlides: (v: boolean) => void;
  onSlidesUpload: (files: FileList | null) => void;
  onRemoveCustomSlides: () => void;
}) {
  const defaultSlides = [
    { gradient: 'linear-gradient(135deg, #7c3aed, #2563eb)', title: `Bienvenido a ${storeName}`, button: 'Ver Catálogo' },
    { gradient: 'linear-gradient(135deg, #2563eb, #0d9488)', title: 'Nuevos Ingresos', button: 'Ver Productos' },
    { gradient: 'linear-gradient(135deg, #ea580c, #dc2626)', title: 'Envío a todo Chile', button: 'Cómo Comprar' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Slide de Portada</h2>
        <p className="text-slate-600">
          Tu tienda incluye 3 slides de ejemplo en la portada. Puedes mantenerlos o quitarlos.
        </p>
      </div>

      {/* Preview of slides */}
      <div className="space-y-3">
        {defaultSlides.map((slide, i) => (
          <div
            key={i}
            className={`rounded-xl overflow-hidden transition-opacity ${!useDefaultSlides ? 'opacity-30' : ''}`}
            style={{ background: slide.gradient }}
          >
            <div className="px-6 py-8 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">{slide.title}</h3>
                <span className="inline-block mt-2 px-4 py-1.5 bg-white/20 rounded-full text-white text-sm">
                  {slide.button}
                </span>
              </div>
              <span className="text-white/30 text-3xl font-bold">{i + 1}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <button
          onClick={() => onToggleSlides(!useDefaultSlides)}
          className={`relative w-12 h-7 rounded-full transition-colors ${useDefaultSlides ? 'bg-blue-700' : 'bg-slate-300'}`}
        >
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${useDefaultSlides ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-slate-700 text-sm">
          {useDefaultSlides ? 'Mantener slides de ejemplo' : 'Sin slides por ahora'}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-slate-900 font-semibold mb-2">O carga tus propios slides</h4>
        <p className="text-slate-600 text-sm mb-3">
          Tamaño recomendado: 1920 x 650 px (mínimo 1600 x 500), formato JPG/PNG/WebP.
        </p>

        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${uploadingSlides ? 'bg-slate-300 text-slate-500' : 'bg-blue-700 hover:bg-blue-600 text-white'}`}>
          <Upload className="w-4 h-4" />
          {uploadingSlides ? 'Subiendo...' : 'Cargar Slides'}
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            disabled={uploadingSlides}
            onChange={(e) => onSlidesUpload(e.target.files)}
          />
        </label>

        {customSlideUrls.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-green-700">{customSlideUrls.length} slide(s) cargado(s)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {customSlideUrls.map((url, index) => (
                <img key={index} src={url} alt={`Slide ${index + 1}`} className="w-full h-20 object-cover rounded-md border border-slate-200" />
              ))}
            </div>
            <button type="button" onClick={onRemoveCustomSlides} className="text-xs text-red-600 hover:text-red-700">
              Quitar slides cargados
            </button>
          </div>
        )}
      </div>

      <p className="text-slate-500 text-xs text-center">
        Podrás personalizar los slides con tus propias imágenes desde Configuración → Diseño → Portada
      </p>
    </div>
  );
}

// ==============================================
// STEP 5: Social Media
// ==============================================
function Step5Social({
  social,
  onSocialChange,
}: {
  social: { instagram: string; facebook: string; whatsapp: string; twitter: string };
  onSocialChange: (s: typeof social) => void;
}) {
  const fields = [
    { key: 'instagram' as const, label: 'Instagram', placeholder: '@tutienda', icon: '📷' },
    { key: 'facebook' as const, label: 'Facebook', placeholder: 'facebook.com/tutienda', icon: '👤' },
    { key: 'whatsapp' as const, label: 'WhatsApp', placeholder: '+56 9 1234 5678', icon: '💬' },
    { key: 'twitter' as const, label: 'Twitter / X', placeholder: '@tutienda', icon: '🐦' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Redes Sociales</h2>
        <p className="text-slate-600">
          Agrega tus redes para que tus clientes puedan encontrarte. Puedes dejar vacío si no tienes.
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="bg-white border border-slate-200 rounded-xl p-4">
            <label className="flex items-center gap-2 text-slate-700 text-sm font-medium mb-2">
              <span className="text-lg">{field.icon}</span>
              {field.label}
            </label>
            <input
              type="text"
              value={social[field.key]}
              onChange={(e) => onSocialChange({ ...social, [field.key]: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ==============================================
// STEP 6: Summary
// ==============================================
function Step6Summary({
  storeName,
  storeSlug,
  logo,
  selectedTheme,
  useDefaultSlides,
  hasCustomSlides,
  social,
}: {
  storeName: string;
  storeSlug: string;
  logo: string;
  selectedTheme: string;
  useDefaultSlides: boolean;
  hasCustomSlides: boolean;
  social: { instagram: string; facebook: string; whatsapp: string; twitter: string };
}) {
  const theme = colorThemes[selectedTheme] || colorThemes.default;

  const checklist = [
    { label: 'Contraseña configurada', done: true },
    { label: 'Logo de la tienda', done: !!logo },
    { label: `Tema: ${theme.name}`, done: true },
    { label: 'Slides de portada', done: useDefaultSlides || hasCustomSlides },
    { label: 'Redes sociales', done: !!(social.instagram || social.facebook || social.whatsapp || social.twitter) },
  ];

  const pendingTasks = [
    { label: 'Agregar tus propios productos', link: '/dashboard/products' },
    { label: 'Personalizar el diseño', link: '/dashboard/settings?tab=diseno' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">¡Todo listo! 🚀</h2>
        <p className="text-slate-600">
          Tu tienda está configurada. Aquí tienes un resumen.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-slate-900 font-semibold mb-4">Resumen de configuración</h3>
        <div className="space-y-3">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.done ? 'bg-green-500' : 'bg-white/10'}`}>
                {item.done ? <Check className="w-3.5 h-3.5 text-white" /> : <span className="text-slate-400 text-xs">—</span>}
              </div>
              <span className={`text-sm ${item.done ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending tasks */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-slate-900 font-semibold mb-3">📋 Próximos pasos recomendados</h3>
        <div className="space-y-2">
          {pendingTasks.map((task, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-blue-700">→</span>
              <span className="text-slate-700">{task.label}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-3">
          Podrás acceder a todo desde el panel de administración.
        </p>
      </div>

      {/* Store URL */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
        <p className="text-blue-700 text-sm mb-2">Tu tienda estará disponible en:</p>
        <p className="text-slate-900 font-mono font-bold text-lg">
          {storeSlug}.mundobeat.cl
        </p>
      </div>
    </div>
  );
}
