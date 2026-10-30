"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProductCategory = {
  id: string;
  name: string;
  slug?: string;
  format?: string;
  parentId?: string | null;
  parent?: { id: string } | null;
  usesMusicMetadata?: boolean;
};

type ProductCategorySelectProps = {
  categories: ProductCategory[];
  selectedCategoryId?: string;
  selectedRootCategoryId?: string;
  onRootChange: (categoryId: string) => void;
  onChange: (categoryId: string | null) => void;
};

const PHYSICAL_FORMAT_ORDER = [
  "vinilo",
  "vinyl",
  "cd",
  "cassette",
  "casete",
  "dvd",
  "vhs",
  "blu-ray",
  "bluray",
];

function getParentId(category?: ProductCategory): string | null {
  return category?.parentId || category?.parent?.id || null;
}

function getPhysicalFormatIndex(category: ProductCategory): number {
  const values = [category.slug, category.format, category.name]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase());

  const index = PHYSICAL_FORMAT_ORDER.findIndex(format => values.some(value => value === format));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export default function ProductCategorySelect({
  categories,
  selectedCategoryId,
  selectedRootCategoryId,
  onRootChange,
  onChange,
}: ProductCategorySelectProps) {
  const selectedCategory = categories.find(category => category.id === selectedCategoryId);
  const rootCategoryId = selectedRootCategoryId
    || (selectedCategory ? getParentId(selectedCategory) || selectedCategory.id : "");

  const rootCategories = useMemo(() => {
    return categories
      .filter(category => !getParentId(category))
      .sort((left, right) => {
        const leftPhysical = getPhysicalFormatIndex(left);
        const rightPhysical = getPhysicalFormatIndex(right);

        if (leftPhysical !== rightPhysical) return leftPhysical - rightPhysical;
        if ((left.usesMusicMetadata !== false) !== (right.usesMusicMetadata !== false)) {
          return left.usesMusicMetadata !== false ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "es");
      });
  }, [categories]);

  const childCategories = useMemo(() => {
    return categories
      .filter(category => getParentId(category) === rootCategoryId)
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [categories, rootCategoryId]);

  const handleRootChange = (categoryId: string) => {
    onRootChange(categoryId);
    const hasChildren = categories.some(category => getParentId(category) === categoryId);
    onChange(hasChildren ? null : categoryId);
  };

  const selectedChildId = selectedCategory && getParentId(selectedCategory) === rootCategoryId
    ? selectedCategory.id
    : "";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Categoría principal *</Label>
        <Select value={rootCategoryId} onValueChange={handleRootChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar categoría principal" />
          </SelectTrigger>
          <SelectContent>
            {rootCategories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {childCategories.length > 0 && (
        <div className="space-y-2">
          <Label>Subcategoría *</Label>
          <Select value={selectedChildId} onValueChange={categoryId => onChange(categoryId)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar subcategoría" />
            </SelectTrigger>
            <SelectContent>
              {childCategories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
