"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { PayPayableForm } from "@/app/(app)/compras/[id]/pay-payable-form";

type Account = { id: string; name: string };

export function PayDialog({
  purchaseId,
  purchaseNumber,
  payableId,
  balance,
  accounts,
}: {
  purchaseId: string;
  purchaseNumber: number;
  payableId: string;
  balance: number;
  accounts: Account[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Pagar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar compra #{purchaseNumber}</DialogTitle>
        </DialogHeader>
        <PayPayableForm purchaseId={purchaseId} payableId={payableId} balance={balance} accounts={accounts} />
      </DialogContent>
    </Dialog>
  );
}
