import StoreReturnsPolicyPage from "@/components/policies/StoreReturnsPolicyPage";

export default async function ReturnsPolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StoreReturnsPolicyPage vendorSlug={slug} />;
}
