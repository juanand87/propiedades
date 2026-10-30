"use client";
import Link from "next/link";
import QuestionsInbox from "@/components/QuestionsInbox";
export default function MyQuestionsPage() { return <main className="min-h-screen bg-gray-50 px-4 py-8"><div className="mx-auto max-w-5xl"><Link href="/" className="mb-6 inline-block text-sm font-semibold text-sky-700">← Volver a la tienda</Link><QuestionsInbox mode="customer" /></div></main>; }
