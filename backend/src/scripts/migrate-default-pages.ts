/**
 * Script de migración para agregar páginas predefinidas a vendors existentes
 * 
 * Este script crea automáticamente las 4 páginas básicas (Políticas de envío,
 * Preguntas Frecuentes, Políticas de cambios y devoluciones, Términos y Condiciones)
 * para todos los vendors que no las tengan y las agrega al menú footer.
 * 
 * Uso:
 *   npm run ts-node src/scripts/migrate-default-pages.ts
 * 
 * o directamente:
 *   npx ts-node src/scripts/migrate-default-pages.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { VendorsService } from '../vendors/vendors.service';
import { Repository } from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { Page } from '../pages/page.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

async function migrate() {
  console.log('🚀 Starting default pages migration...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  
  const vendorsRepository = app.get<Repository<Vendor>>(getRepositoryToken(Vendor));
  const pagesRepository = app.get<Repository<Page>>(getRepositoryToken(Page));
  const settingsRepository = app.get<Repository<VendorSettings>>(getRepositoryToken(VendorSettings));

  try {
    // Obtener todos los vendors activos
    const vendors = await vendorsRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });

    console.log(`📊 Found ${vendors.length} active vendors\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const vendor of vendors) {
      console.log(`\n📦 Processing vendor: ${vendor.storeName} (${vendor.slug})`);

      try {
        // Verificar si ya tiene las páginas predefinidas
        const existingPages = await pagesRepository.find({
          where: { vendorId: vendor.id },
        });

        const hasDefaultPages = existingPages.some(p => 
          p.slug === 'politicas-de-envio' ||
          p.slug === 'preguntas-frecuentes' ||
          p.slug === 'politicas-de-cambios-y-devoluciones' ||
          p.slug === 'terminos-y-condiciones'
        );

        if (hasDefaultPages) {
          console.log(`⏭️  Vendor already has default pages, skipping...`);
          skippedCount++;
          continue;
        }

        // Definir las páginas predefinidas
        const defaultPages = [
          {
            title: `Políticas de envío de ${vendor.storeName}`,
            slug: 'politicas-de-envio',
            description: `Conoce las políticas de envío de ${vendor.storeName}`,
            content: `<h2>Políticas de envío</h2>
<p>En <strong>${vendor.storeName}</strong> estamos comprometidos con entregarte tus productos de forma rápida y segura.</p>

<h3>Tiempos de entrega</h3>
<p>Una vez confirmado el pago, procesamos tu pedido en un plazo de 24 a 48 horas hábiles.</p>
<p>El tiempo de entrega depende de tu ubicación y del servicio de envío seleccionado:</p>
<ul>
  <li><strong>Santiago y principales ciudades:</strong> 2 a 4 días hábiles</li>
  <li><strong>Regiones:</strong> 3 a 7 días hábiles</li>
  <li><strong>Zonas extremas:</strong> 5 a 10 días hábiles</li>
</ul>

<h3>Costos de envío</h3>
<p>Los costos de envío se calculan automáticamente al momento de finalizar tu compra según tu ubicación.</p>

<h3>Seguimiento de pedido</h3>
<p>Una vez despachado tu pedido, recibirás un correo electrónico con el número de seguimiento para que puedas rastrear tu envío en tiempo real.</p>

<h3>Contacto</h3>
<p>Si tienes dudas sobre tu envío, contáctanos y te ayudaremos a resolver cualquier inquietud.</p>`,
          },
          {
            title: `Preguntas Frecuentes - ${vendor.storeName}`,
            slug: 'preguntas-frecuentes',
            description: `Respuestas a las preguntas más comunes sobre ${vendor.storeName}`,
            content: `<h2>Preguntas Frecuentes</h2>

<h3>¿Cómo puedo realizar una compra?</h3>
<p>Simplemente agrega los productos que desees al carrito, completa tus datos de envío y procede al pago. Aceptamos múltiples métodos de pago para tu comodidad.</p>

<h3>¿Qué métodos de pago aceptan?</h3>
<p>Aceptamos pagos a través de:</p>
<ul>
  <li>Tarjetas de débito y crédito</li>
  <li>Transferencia bancaria</li>
  <li>Otros métodos de pago disponibles en el checkout</li>
</ul>

<h3>¿Puedo modificar o cancelar mi pedido?</h3>
<p>Si necesitas modificar o cancelar tu pedido, contáctanos lo antes posible. Si el pedido aún no ha sido despachado, haremos todo lo posible para ayudarte.</p>

<h3>¿Los productos tienen garantía?</h3>
<p>Todos nuestros productos cuentan con garantía. Revisa la descripción de cada producto para conocer los detalles específicos.</p>

<h3>¿Cómo puedo contactarlos?</h3>
<p>Puedes contactarnos a través de nuestro formulario de contacto o escribirnos directamente. Respondemos todas las consultas a la brevedad posible.</p>`,
          },
          {
            title: `Políticas de cambios y devoluciones - ${vendor.storeName}`,
            slug: 'politicas-de-cambios-y-devoluciones',
            description: `Conoce las políticas de cambios y devoluciones de ${vendor.storeName}`,
            content: `<h2>Políticas de cambios y devoluciones</h2>

<h3>Derecho a cambio</h3>
<p>En <strong>${vendor.storeName}</strong> queremos que estés completamente satisfecho con tu compra. Si no estás conforme con tu producto, tienes <strong>10 días corridos</strong> desde la recepción para solicitar un cambio.</p>

<h3>Condiciones para cambios</h3>
<p>Para que podamos procesar tu cambio, el producto debe cumplir con las siguientes condiciones:</p>
<ul>
  <li>Estar en perfecto estado, sin uso y con todas sus etiquetas</li>
  <li>Incluir todos los accesorios y embalaje original</li>
  <li>No presentar señales de uso o daño</li>
</ul>

<h3>Proceso de cambio</h3>
<ol>
  <li>Contáctanos dentro de los 10 días posteriores a la recepción</li>
  <li>Indícanos el motivo del cambio y envíanos fotos del producto</li>
  <li>Te daremos las instrucciones para devolver el producto</li>
  <li>Una vez recibido y verificado, procesaremos tu cambio</li>
</ol>

<h3>Costos de envío</h3>
<p>Los costos de envío para cambios dependen del motivo:</p>
<ul>
  <li><strong>Error nuestro o producto defectuoso:</strong> Nos hacemos cargo del envío</li>
  <li><strong>Cambio por preferencia del cliente:</strong> El costo de envío corre por cuenta del cliente</li>
</ul>

<h3>Devolución de dinero</h3>
<p>Las devoluciones de dinero se evaluarán caso a caso. Contáctanos para más información.</p>`,
          },
          {
            title: `Términos y Condiciones - ${vendor.storeName}`,
            slug: 'terminos-y-condiciones',
            description: `Términos y condiciones de uso de ${vendor.storeName}`,
            content: `<h2>Términos y Condiciones</h2>

<h3>1. Aceptación de términos</h3>
<p>Al acceder y utilizar este sitio web, aceptas estar sujeto a estos términos y condiciones de uso.</p>

<h3>2. Uso del sitio</h3>
<p>Este sitio web es operado por <strong>${vendor.storeName}</strong>. El contenido de este sitio es solo para tu información general y uso. Está sujeto a cambios sin previo aviso.</p>

<h3>3. Productos y precios</h3>
<p>Nos esforzamos por mantener la información de productos y precios actualizada. Sin embargo, nos reservamos el derecho de modificar precios y disponibilidad sin previo aviso.</p>

<h3>4. Compras</h3>
<p>Al realizar una compra, garantizas que:</p>
<ul>
  <li>Eres mayor de edad</li>
  <li>La información proporcionada es verdadera y precisa</li>
  <li>Tienes autorización para usar el método de pago seleccionado</li>
</ul>

<h3>5. Privacidad</h3>
<p>Respetamos tu privacidad. La información personal que nos proporcionas se utilizará únicamente para procesar tus pedidos y mejorar tu experiencia de compra.</p>

<h3>6. Propiedad intelectual</h3>
<p>Todo el contenido de este sitio web, incluyendo textos, gráficos, logos e imágenes, es propiedad de <strong>${vendor.storeName}</strong> o sus proveedores de contenido.</p>

<h3>7. Limitación de responsabilidad</h3>
<p>No seremos responsables de daños directos, indirectos, incidentales o consecuentes que resulten del uso o la imposibilidad de usar este sitio web.</p>

<h3>8. Modificaciones</h3>
<p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Es tu responsabilidad revisar periódicamente estos términos.</p>

<h3>9. Contacto</h3>
<p>Si tienes preguntas sobre estos términos y condiciones, por favor contáctanos.</p>`,
          },
        ];

        const createdPageIds: string[] = [];

        // Crear las páginas
        for (const pageData of defaultPages) {
          const page = pagesRepository.create({
            title: pageData.title,
            slug: pageData.slug,
            description: pageData.description,
            blocks: [
              {
                id: `text-${Date.now()}-${Math.random()}`,
                type: 'text',
                text: pageData.content,
                row: 0,
                column: 0,
              },
            ],
            isPublished: true,
            isHomepage: false,
            vendorId: vendor.id,
            rowsConfig: [{ row: 0, columns: 1 }],
          });

          const savedPage = await pagesRepository.save(page);
          createdPageIds.push(savedPage.id);
          console.log(`   ✅ Created: ${pageData.title.substring(0, 50)}...`);
        }

        // Actualizar el menú footer con las páginas creadas
        if (createdPageIds.length > 0) {
          let settings = await settingsRepository.findOne({ where: { vendorId: vendor.id } });
          
          if (!settings) {
            settings = settingsRepository.create({
              vendorId: vendor.id,
              customMenus: {},
            });
          }

          if (!settings.customMenus) {
            settings.customMenus = {};
          }

          if (!settings.customMenus.footer) {
            settings.customMenus.footer = { items: [] };
          }

          // Agregar las páginas al menú footer
          const footerItems = defaultPages.map((pageData, index) => ({
            id: `footer-page-${index}-${Date.now()}`,
            label: pageData.title
              .replace(` de ${vendor.storeName}`, '')
              .replace(` - ${vendor.storeName}`, ''),
            linkType: 'page',
            pageId: createdPageIds[index],
            url: '',
            categorySlug: '',
            genreSlug: '',
            isVisible: true,
          }));

          settings.customMenus.footer.items = footerItems;
          await settingsRepository.save(settings);
          
          console.log(`   ✅ Added ${footerItems.length} items to footer menu`);
        }

        processedCount++;
        console.log(`✅ Vendor ${vendor.storeName} completed successfully`);

      } catch (error) {
        console.error(`❌ Error processing vendor ${vendor.storeName}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Migration Summary:');
    console.log(`   Total vendors: ${vendors.length}`);
    console.log(`   ✅ Successfully processed: ${processedCount}`);
    console.log(`   ⏭️  Skipped (already had pages): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }

  await app.close();
  console.log('✅ Migration completed. Application closed.');
  process.exit(0);
}

migrate();
