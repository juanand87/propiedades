"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Disc, Music } from "lucide-react";

export default function EscalaGoldminePage() {
  const grades = [
    {
      code: "M",
      name: "Mint (Como Nuevo)",
      color: "from-emerald-500 to-green-500",
      description: "Perfecto en todos los aspectos. Sin uso, sellado original. Raramente disponible para discos usados.",
      vinyl: "Sin marcas, rasguños ni señales de uso.",
      cover: "Impecable, sin desgaste, esquinas perfectas.",
    },
    {
      code: "NM/M-",
      name: "Near Mint (Casi Nuevo)",
      color: "from-green-500 to-emerald-600",
      description: "Casi perfecto. Puede haber sido reproducido una o dos veces. Mínimas imperfecciones visibles solo bajo inspección detallada.",
      vinyl: "Superficie brillante, sin marcas audibles. Puede tener marcas de fábrica leves.",
      cover: "Casi perfecto, esquinas limpias, sin desgaste visible.",
    },
    {
      code: "VG+",
      name: "Very Good Plus (Muy Bueno Plus)",
      color: "from-blue-500 to-cyan-500",
      description: "Excelente condición con mínimos signos de uso. Algunas marcas superficiales leves que no afectan la reproducción.",
      vinyl: "Marcas superficiales leves, sin saltos. Sonido excelente con ruido de fondo mínimo.",
      cover: "Desgaste menor en esquinas, sin roturas. Puede tener leve decoloración.",
    },
    {
      code: "VG",
      name: "Very Good (Muy Bueno)",
      color: "from-yellow-500 to-amber-500",
      description: "Buen disco usado con señales evidentes de uso pero totalmente reproducible. Valorado por coleccionistas.",
      vinyl: "Marcas superficiales visibles, posible ruido de fondo leve. Sin saltos.",
      cover: "Desgaste notorio, esquinas dobladas, posibles marcas de anillo.",
    },
    {
      code: "G+",
      name: "Good Plus (Bueno Plus)",
      color: "from-orange-500 to-amber-600",
      description: "Disco usado con desgaste considerable. Reproducible pero con deterioro audible.",
      vinyl: "Marcas y rasguños visibles, chasquidos y ruido de superficie presente.",
      cover: "Desgaste evidente, roturas menores, manchas o escritura.",
    },
    {
      code: "G",
      name: "Good (Bueno)",
      color: "from-red-500 to-orange-600",
      description: "Muy usado. Reproducible pero con deterioro significativo. Aún valorado si es un título raro.",
      vinyl: "Rasguños profundos, chasquidos frecuentes, pérdida de fidelidad.",
      cover: "Deterioro severo, roturas, manchas extensas.",
    },
    {
      code: "P/F",
      name: "Poor/Fair (Malo)",
      color: "from-gray-500 to-slate-600",
      description: "Condición muy pobre. Solo valorado por su contenido extremadamente raro o como pieza de reemplazo.",
      vinyl: "Muy rayado, saltos posibles, deterioro extremo.",
      cover: "Muy dañado, roturas extensas, puede faltar información.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <Disc className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold mb-3">Escala de Gradación Goldmine</h1>
            <p className="text-lg text-purple-100">
              El estándar internacional para evaluar la condición de discos de vinilo
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Intro Card */}
          <Card className="mb-8 shadow-lg">
            <CardContent className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">¿Qué es la Escala Goldmine?</h2>
                  <p className="text-gray-600 leading-relaxed">
                    La escala de Goldmine es el sistema estándar utilizado por coleccionistas, tiendas y vendedores de discos de vinilo en todo el mundo para describir la condición física de un disco. Creada por la revista especializada <strong>Goldmine Magazine</strong>, esta escala evalúa tanto el vinilo como la portada de manera objetiva.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-purple-500 p-6 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <Music className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-purple-900 mb-2">Nota Importante</h3>
                    <p className="text-purple-800 text-sm leading-relaxed">
                      En Mundo Beat, cada producto incluye la gradación tanto del <strong>medio (vinilo)</strong> como de la <strong>portada</strong>. Por ejemplo: "VG+/VG" significa vinilo en Very Good Plus y portada en Very Good.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grades */}
          <div className="space-y-6">
            {grades.map((grade, index) => (
              <Card key={grade.code} className="shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${grade.color}`}></div>
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    {/* Badge */}
                    <div className={`w-20 h-20 bg-gradient-to-br ${grade.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <span className="text-white font-bold text-xl">{grade.code}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-2">{grade.name}</h3>
                      <p className="text-gray-600 mb-4 leading-relaxed">{grade.description}</p>

                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Vinilo */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Disc className="w-4 h-4 text-purple-600" />
                            <h4 className="font-semibold text-sm uppercase tracking-wide text-purple-900">Vinilo</h4>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{grade.vinyl}</p>
                        </div>

                        {/* Portada */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Music className="w-4 h-4 text-pink-600" />
                            <h4 className="font-semibold text-sm uppercase tracking-wide text-pink-900">Portada</h4>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{grade.cover}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Footer Info */}
          <Card className="mt-12 shadow-lg bg-gradient-to-r from-purple-50 to-pink-50">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">¿Tienes preguntas sobre la condición de un disco?</h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Cada vendedor en Mundo Beat evalúa cuidadosamente sus productos usando esta escala. Si tienes dudas sobre la condición de un artículo específico, no dudes en contactar directamente al vendedor.
              </p>
              <Link
                href="/catalogo"
                className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Explorar Catálogo
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
