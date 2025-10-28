import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Invoice, Quote } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Download, Tags, Pencil } from "lucide-react";
import { generateInvoicePDF, generateLabelsPDF } from "@/lib/pdf-generator";
import { LabelsPreview } from "@/components/labels-preview";

export default function AdminInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [labelsPreviewOpen, setLabelsPreviewOpen] = useState(false);
  const [selectedInvoiceForLabels, setSelectedInvoiceForLabels] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    quoteId: "",
    clientId: "",
    invoiceNumber: "",
    amount: "",
    notes: "",
    dueDate: "",
  });

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      toast({
        title: "Non autorisé",
        description: "Vous n'avez pas la permission d'accéder à cette page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, isLoading, isAdmin, toast]);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/admin/invoices"],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/admin/quotes"],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: services = [] } = useQuery<any[]>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated,
  });

  const approvedQuotes = quotes.filter((q) => q.status === "approved");

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const quote = quotes.find(q => q.id === invoice.quoteId);
      const service = services.find(s => s.id === quote?.serviceId);
      const clientInfo = { 
        name: `Client-${invoice.clientId.slice(0, 8)}`,
        email: 'client@myjantes.fr'
      };
      
      // Fetch invoice items
      const itemsRes = await fetch(`/api/admin/invoices/${invoice.id}/items`, { credentials: 'include' });
      const invoiceItems = itemsRes.ok ? await itemsRes.json() : [];
      
      generateInvoicePDF(invoice, clientInfo, quote, service, invoiceItems);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF de la facture.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadLabels = async (invoice: Invoice) => {
    setSelectedInvoiceForLabels(invoice);
    setLabelsPreviewOpen(true);
  };

  const handleConfirmDownloadLabels = async () => {
    if (!selectedInvoiceForLabels) return;
    
    try {
      await generateLabelsPDF(selectedInvoiceForLabels, 'invoice');
      toast({
        title: "✅ Étiquettes téléchargées !",
        description: "5 étiquettes avec QR codes ont été générées et téléchargées avec succès.",
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Échec de la génération des étiquettes",
        variant: "destructive",
      });
    }
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/invoices", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Facture créée avec succès",
      });
      setIsDialogOpen(false);
      setFormData({
        quoteId: "",
        clientId: "",
        invoiceNumber: "",
        amount: "",
        notes: "",
        dueDate: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la création de la facture",
        variant: "destructive",
      });
    },
  });

  const handleQuoteSelect = (quoteId: string) => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (quote) {
      setFormData({
        ...formData,
        quoteId: quote.id,
        clientId: quote.clientId,
        amount: quote.quoteAmount || "",
      });
    }
  };

  const handleCreateInvoice = () => {
    const invoiceNumber = `INV-${Date.now()}`;
    createInvoiceMutation.mutate({
      quoteId: formData.quoteId,
      clientId: formData.clientId,
      invoiceNumber,
      amount: parseFloat(formData.amount),
      notes: formData.notes || undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      status: "pending",
    });
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold" data-testid="text-admin-invoices-title">Gestion des Factures</h1>
        <Button
          onClick={() => setIsDialogOpen(true)}
          data-testid="button-create-invoice"
        >
          <Plus className="h-4 w-4 mr-2" />
          Créer une Facture
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les Factures</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucune facture pour le moment. Créez-en une pour commencer!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border border-border rounded-md hover-elevate"
                  data-testid={`invoice-item-${invoice.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold font-mono">{invoice.invoiceNumber}</p>
                      <StatusBadge status={invoice.status as any} />
                    </div>
                    <p className="text-sm text-muted-foreground">Client: {invoice.clientId.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">Devis: {invoice.quoteId.slice(0, 8)}</p>
                    {invoice.wheelCount && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Jantes:</span> {invoice.wheelCount} 
                        {invoice.diameter && <span> | <span className="font-medium">Diamètre:</span> {invoice.diameter}</span>}
                      </p>
                    )}
                    {invoice.priceExcludingTax && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Prix HT:</span> {parseFloat(invoice.priceExcludingTax).toFixed(2)} € 
                        {invoice.taxRate && <span> | <span className="font-medium">TVA:</span> {parseFloat(invoice.taxRate).toFixed(0)}%</span>}
                      </p>
                    )}
                    {invoice.productDetails && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        <span className="font-medium">Produits:</span> {invoice.productDetails}
                      </p>
                    )}
                    {invoice.createdAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true, locale: fr })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono font-bold text-xl">{invoice.amount} €</p>
                      {invoice.dueDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Échéance: {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/admin/invoices/${invoice.id}/edit`)}
                        data-testid={`button-edit-invoice-${invoice.id}`}
                      >
                        <Pencil className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Éditer</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPDF(invoice)}
                        data-testid={`button-download-invoice-pdf-${invoice.id}`}
                      >
                        <Download className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadLabels(invoice)}
                        data-testid={`button-download-labels-${invoice.id}`}
                      >
                        <Tags className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Étiquettes</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une Nouvelle Facture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quote-select">Sélectionner un Devis Approuvé</Label>
              <Select
                value={formData.quoteId}
                onValueChange={handleQuoteSelect}
              >
                <SelectTrigger id="quote-select" data-testid="select-quote">
                  <SelectValue placeholder="Sélectionner un devis" />
                </SelectTrigger>
                <SelectContent>
                  {approvedQuotes.map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      Devis #{quote.id.slice(0, 8)} - {quote.quoteAmount} €
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="invoice-amount">Montant ($)</Label>
              <Input
                id="invoice-amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="mt-2"
                data-testid="input-invoice-amount"
              />
            </div>
            <div>
              <Label htmlFor="invoice-due-date">Date d'Échéance</Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="mt-2"
                data-testid="input-invoice-due-date"
              />
            </div>
            <div>
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea
                id="invoice-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ajouter des notes..."
                className="mt-2"
                rows={3}
                data-testid="textarea-invoice-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              data-testid="button-cancel-invoice"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={createInvoiceMutation.isPending || !formData.quoteId || !formData.amount}
              data-testid="button-save-invoice"
            >
              {createInvoiceMutation.isPending ? "Création..." : "Créer la Facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LabelsPreview
        open={labelsPreviewOpen}
        onOpenChange={setLabelsPreviewOpen}
        documentNumber={selectedInvoiceForLabels?.invoiceNumber || ""}
        onDownload={handleConfirmDownloadLabels}
        type="invoice"
      />
    </div>
  );
}
