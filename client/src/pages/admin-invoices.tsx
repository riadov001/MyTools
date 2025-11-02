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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Download, Tags, Pencil, X } from "lucide-react";
import { generateInvoicePDF, generateLabelsPDF } from "@/lib/pdf-generator";
import { LabelsPreview } from "@/components/labels-preview";
import { ObjectUploader } from "@/components/ObjectUploader";

export default function AdminInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createDirectInvoiceDialog, setCreateDirectInvoiceDialog] = useState(false);
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

  // Direct invoice creation states
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedServices, setSelectedServices] = useState<Array<{
    serviceId: string;
    serviceName: string;
    quantity: string;
    unitPrice: string;
  }>>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<"cash" | "wire_transfer" | "card">("wire_transfer");
  const [invoiceWheelCount, setInvoiceWheelCount] = useState("4");
  const [invoiceDiameter, setInvoiceDiameter] = useState("");
  const [invoiceTaxRate, setInvoiceTaxRate] = useState("20");
  const [invoiceProductDetails, setInvoiceProductDetails] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceMediaFiles, setInvoiceMediaFiles] = useState<any[]>([]);

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

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isAdmin,
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
      
      await generateInvoicePDF(invoice, clientInfo, quote, service, invoiceItems);
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

  // Functions for direct invoice creation
  const addServiceToInvoice = () => {
    if (!selectedServiceId) return;
    const service = services.find(s => s.id === selectedServiceId);
    if (!service) return;
    
    setSelectedServices([...selectedServices, {
      serviceId: service.id,
      serviceName: service.name,
      quantity: "1",
      unitPrice: service.basePrice || "0",
    }]);
    setSelectedServiceId("");
  };

  const updateServiceQuantity = (index: number, quantity: string) => {
    const updated = [...selectedServices];
    updated[index].quantity = quantity;
    setSelectedServices(updated);
  };

  const updateServicePrice = (index: number, price: string) => {
    const updated = [...selectedServices];
    updated[index].unitPrice = price;
    setSelectedServices(updated);
  };

  const removeServiceFromInvoice = (index: number) => {
    setSelectedServices(selectedServices.filter((_, i) => i !== index));
  };

  const calculateTotalHT = () => {
    const wheelMultiplier = parseInt(invoiceWheelCount) || 1;
    return selectedServices.reduce((total, service) => {
      return total + (parseFloat(service.quantity) * parseFloat(service.unitPrice) * wheelMultiplier);
    }, 0);
  };

  const calculateTaxAmount = () => {
    return (calculateTotalHT() * parseFloat(invoiceTaxRate)) / 100;
  };

  const calculateTotalTTC = () => {
    return calculateTotalHT() + calculateTaxAmount();
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

  const createDirectInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/invoices/direct", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Facture créée avec succès",
      });
      setCreateDirectInvoiceDialog(false);
      setSelectedClientId("");
      setSelectedServices([]);
      setInvoiceMediaFiles([]);
      setInvoiceNotes("");
      setInvoiceDueDate("");
      setInvoiceProductDetails("");
      setInvoiceTaxRate("20");
      setInvoiceWheelCount("4");
      setInvoiceDiameter("");
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

  const handleCreateDirectInvoice = async () => {
    // Validation with user feedback
    if (!selectedClientId) {
      toast({
        title: "Client requis",
        description: "Veuillez sélectionner un client",
        variant: "destructive",
      });
      return;
    }

    if (selectedServices.length === 0) {
      toast({
        title: "Services requis",
        description: "Veuillez ajouter au moins un service",
        variant: "destructive",
      });
      return;
    }

    const imageCount = invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length;
    if (imageCount < 3) {
      toast({
        title: "Images requises",
        description: `Au moins 3 images sont requises (${imageCount}/3 fournies)`,
        variant: "destructive",
      });
      return;
    }

    const wheelMultiplier = parseInt(invoiceWheelCount) || 1;
    const invoiceItems = selectedServices.map(service => {
      const baseTotal = parseFloat(service.quantity) * parseFloat(service.unitPrice);
      const totalWithWheels = baseTotal * wheelMultiplier;
      const taxAmount = (totalWithWheels * parseFloat(invoiceTaxRate)) / 100;
      
      return {
        description: service.serviceName,
        quantity: parseFloat(service.quantity),
        unitPriceExcludingTax: parseFloat(service.unitPrice),
        totalExcludingTax: totalWithWheels,
        taxRate: parseFloat(invoiceTaxRate),
        taxAmount: taxAmount,
        totalIncludingTax: totalWithWheels + taxAmount,
      };
    });

    createDirectInvoiceMutation.mutate({
      clientId: selectedClientId,
      paymentMethod: invoicePaymentMethod,
      amount: calculateTotalTTC().toFixed(2),
      wheelCount: parseInt(invoiceWheelCount),
      diameter: invoiceDiameter || null,
      priceExcludingTax: calculateTotalHT().toFixed(2),
      taxRate: invoiceTaxRate,
      taxAmount: calculateTaxAmount().toFixed(2),
      productDetails: invoiceProductDetails || null,
      notes: invoiceNotes || null,
      dueDate: invoiceDueDate ? new Date(invoiceDueDate) : undefined,
      status: "pending",
      invoiceItems,
      mediaFiles: invoiceMediaFiles,
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-admin-invoices-title">Gestion des Factures</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsDialogOpen(true)}
            variant="outline"
            className="w-full sm:w-auto"
            data-testid="button-create-invoice-from-quote"
          >
            <Plus className="h-4 w-4 mr-2" />
            Depuis Devis
          </Button>
          <Button
            onClick={() => setCreateDirectInvoiceDialog(true)}
            className="w-full sm:w-auto"
            data-testid="button-create-direct-invoice"
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer une Facture
          </Button>
        </div>
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
                  className="p-4 border border-border rounded-md hover-elevate"
                  data-testid={`invoice-item-${invoice.id}`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-semibold font-mono">{invoice.invoiceNumber}</p>
                        <StatusBadge status={invoice.status as any} />
                      </div>
                      <p className="text-sm text-muted-foreground">Client: {invoice.clientId.slice(0, 8)}</p>
                      {invoice.quoteId && (
                        <p className="text-sm text-muted-foreground">Devis: {invoice.quoteId.slice(0, 8)}</p>
                      )}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t">
                      <div>
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une Nouvelle Facture depuis Devis</DialogTitle>
            <DialogDescription>
              Générez une facture à partir d'un devis approuvé existant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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

      <Dialog open={createDirectInvoiceDialog} onOpenChange={setCreateDirectInvoiceDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Créer une Nouvelle Facture</DialogTitle>
            <DialogDescription>
              Créez une facture directement sans passer par un devis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-2 flex-1">
            <div>
              <Label htmlFor="direct-invoice-client">Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="mt-2" data-testid="select-direct-invoice-client">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.role === "client" || u.role === "client_professionnel").map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Services</Label>
              <div className="flex gap-2">
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger className="flex-1" data-testid="select-service-to-add">
                    <SelectValue placeholder="Sélectionner un service à ajouter" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {parseFloat(service.basePrice || "0").toFixed(2)} €
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={addServiceToInvoice}
                  disabled={!selectedServiceId}
                  data-testid="button-add-service"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {selectedServices.length > 0 && (
                <div className="border rounded-md p-3 space-y-2">
                  <p className="text-sm font-medium">Services ajoutés:</p>
                  {selectedServices.map((service, index) => {
                    const wheelMultiplier = parseInt(invoiceWheelCount) || 1;
                    const subtotal = parseFloat(service.quantity) * parseFloat(service.unitPrice);
                    const totalWithWheels = subtotal * wheelMultiplier;
                    
                    return (
                      <div key={index} className="space-y-2 p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{service.serviceName}</p>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeServiceFromInvoice(index)}
                            className="h-8 w-8 shrink-0"
                            data-testid={`button-remove-service-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs shrink-0">Qté:</Label>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              placeholder="Qté"
                              value={service.quantity}
                              onChange={(e) => updateServiceQuantity(index, e.target.value)}
                              className="w-16 h-8"
                              data-testid={`input-service-quantity-${index}`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs shrink-0">Prix/u:</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Prix"
                              value={service.unitPrice}
                              onChange={(e) => updateServicePrice(index, e.target.value)}
                              className="w-24 h-8"
                              data-testid={`input-service-price-${index}`}
                            />
                          </div>
                          <div className="flex-1 text-right sm:text-left">
                            <p className="text-xs text-muted-foreground">
                              {subtotal.toFixed(2)} € × {wheelMultiplier} jante{wheelMultiplier > 1 ? 's' : ''}
                            </p>
                            <p className="text-sm font-mono font-semibold">
                              = {totalWithWheels.toFixed(2)} €
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="direct-invoice-payment-method">Moyen de paiement</Label>
              <Select value={invoicePaymentMethod} onValueChange={(v) => setInvoicePaymentMethod(v as "cash" | "wire_transfer" | "card")}>
                <SelectTrigger className="mt-2" data-testid="select-direct-invoice-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="wire_transfer">Virement</SelectItem>
                  <SelectItem value="card">Carte bleue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="direct-invoice-wheel-count">Nombre de jantes</Label>
                <Select value={invoiceWheelCount} onValueChange={setInvoiceWheelCount}>
                  <SelectTrigger className="mt-2" data-testid="select-direct-invoice-wheel-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 jante</SelectItem>
                    <SelectItem value="2">2 jantes</SelectItem>
                    <SelectItem value="3">3 jantes</SelectItem>
                    <SelectItem value="4">4 jantes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="direct-invoice-diameter">Diamètre</Label>
                <Input
                  id="direct-invoice-diameter"
                  type="text"
                  placeholder="Ex: 17 pouces"
                  value={invoiceDiameter}
                  onChange={(e) => setInvoiceDiameter(e.target.value)}
                  className="mt-2"
                  data-testid="input-direct-invoice-diameter"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="direct-invoice-tax-rate">TVA (%)</Label>
              <Input
                id="direct-invoice-tax-rate"
                type="number"
                step="0.01"
                placeholder="20"
                value={invoiceTaxRate}
                onChange={(e) => setInvoiceTaxRate(e.target.value)}
                className="mt-2"
                data-testid="input-direct-invoice-tax-rate"
              />
            </div>

            {selectedServices.length > 0 && (
              <div className="p-4 bg-muted rounded-md space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span>Total HT:</span>
                  <span className="font-mono">{calculateTotalHT().toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>TVA ({invoiceTaxRate}%):</span>
                  <span className="font-mono">{calculateTaxAmount().toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center font-bold text-base pt-2 border-t border-border">
                  <span>Total TTC:</span>
                  <span className="font-mono text-primary">{calculateTotalTTC().toFixed(2)} €</span>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="direct-invoice-product-details">Détails du produit</Label>
              <Textarea
                id="direct-invoice-product-details"
                placeholder="Description du produit, références, caractéristiques..."
                value={invoiceProductDetails}
                onChange={(e) => setInvoiceProductDetails(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="textarea-direct-invoice-product-details"
              />
            </div>

            <div>
              <Label htmlFor="direct-invoice-due-date">Date d'Échéance</Label>
              <Input
                id="direct-invoice-due-date"
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="mt-2"
                data-testid="input-direct-invoice-due-date"
              />
            </div>

            <div>
              <Label htmlFor="direct-invoice-notes">Notes additionnelles (optionnel)</Label>
              <Textarea
                id="direct-invoice-notes"
                placeholder="Notes complémentaires..."
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="textarea-direct-invoice-notes"
              />
            </div>

            <div>
              <Label>Images et Vidéos</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Minimum 3 images requises. Vidéos optionnelles.
              </p>
              <ObjectUploader
                onUploadComplete={(files) => setInvoiceMediaFiles(files)}
                accept={{
                  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
                  'video/*': ['.mp4', '.webm', '.mov']
                }}
                data-testid="uploader-direct-invoice-media"
              />
              {invoiceMediaFiles.length > 0 && invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length < 3 && (
                <p className="text-sm text-destructive mt-2">
                  Au moins 3 images sont requises ({invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length}/3)
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDirectInvoiceDialog(false);
                setInvoiceMediaFiles([]);
              }}
              className="flex-1 sm:flex-none"
              data-testid="button-cancel-direct-invoice"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateDirectInvoice}
              disabled={
                createDirectInvoiceMutation.isPending ||
                !selectedClientId ||
                selectedServices.length === 0 ||
                invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length < 3
              }
              className="flex-1 sm:flex-none"
              data-testid="button-save-direct-invoice"
            >
              {createDirectInvoiceMutation.isPending ? "Création..." : "Créer Facture"}
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
