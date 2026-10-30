import Link from "next/link";
import { BookOpen, FilePlus2, Files, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TutorialsPage() {
  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase text-sky-700">Manuales</p><h1 className="text-3xl font-bold text-slate-900">Tutoriales</h1><p className="mt-1 text-slate-600">Crea y administra tutoriales con el editor de páginas existente.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border bg-white p-6"><BookOpen className="h-8 w-8 text-sky-600" /><h2 className="mt-4 text-xl font-bold">Administrar tutoriales</h2><p className="mt-2 text-sm leading-6 text-slate-600">Revisa las páginas publicadas, edita sus bloques y organiza el contenido de ayuda.</p><Link href="/panel/pages"><Button className="mt-5 bg-slate-900 hover:bg-slate-800"><Files className="mr-2 h-4 w-4" />Ver páginas</Button></Link></div>
        <div className="border bg-white p-6"><FilePlus2 className="h-8 w-8 text-rose-600" /><h2 className="mt-4 text-xl font-bold">Crear un tutorial</h2><p className="mt-2 text-sm leading-6 text-slate-600">Usa bloques de texto, imágenes y video para explicar cada procedimiento paso a paso.</p><Link href="/panel/pages/new"><Button variant="outline" className="mt-5"><Plus className="mr-2 h-4 w-4" />Nuevo tutorial</Button></Link></div>
      </div>
    </div>
  );
}
