"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { PayReceivableForm } from "@/app/(app)/ventas/[id]/pay-receivable-form";

type Account = { id: string; name: string };

export function CollectDialog({
  saleId,
  saleNumber,
  receivableId,
  balance,
  accounts,
}: {
  saleId: string;
  saleNumber: number;
  receivableId: string;
  balance: number;
  accounts: Account[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Cobrar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar venta #{saleNumber}</DialogTitle>
        </DialogHeader>
        <PayReceivableForm saleId={saleId} receivableId={receivableId} balance={balance} accounts={accounts} />
      </DialogContent>
    </Dialog>
  );
}
