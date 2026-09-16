"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Variant = {
  id: string;
  label: string;
  categoryName: string;
  inventoryType: "QUANTITY" | "SERIALIZED";
};

export function VariantPickerList({ variants, hrefBase }: { variants: Variant[]; hrefBase: string }) {
  const [query, setQuery] = useState("");
  const filtered = variants.filter((v) => v.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar producto..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="border-border divide-border flex flex-col divide-y overflow-hidden rounded-lg border">
        {filtered.map((v) => (
          <Link
            key={v.id}
            href={`${hrefBase}/${v.id}`}
            className="hover:bg-accent flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
          >
            <span>{v.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">{v.categoryName}</span>
              <Badge variant="outline">
                {v.inventoryType === "QUANTITY" ? "Cantidad" : "Serializado"}
              </Badge>
            </span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">Sin resultados.</p>
        )}
      </div>
    </div>
  );
}
