import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Quote, User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, X, FileText, Calendar, Download, Plus, Pencil, Tags, Search } from "lucide-react";
import { generateQuotePDF, generateLabelsPDF } from "@/lib/pdf-generator";
import { ObjectUploader } from "@/components/ObjectUploader";
import { LabelsPreview } from "@/components/labels-preview";
import { NewClientForm } from "@/components/new-client-form";

export default function AdminQuotes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [notes, setNotes] = useState("");
  
  const [invoiceDialog, setInvoiceDialog] = useState<Quote | null>(null);
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceMediaFiles, setInvoiceMediaFiles] = useState<Array<{key: string; type: string; name: string}>>([]);
  
  const [reservationDialog, setReservationDialog] = useState<Quote | null>(null);
  const [reservationDate, setReservationDate] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");

  const [labelsPreviewOpen, setLabelsPreviewOpen] = useState(false);
  const [selectedQuoteForLabels, setSelectedQuoteForLabels] = useState<Quote | null>(null);
  
  const [createQuoteDialog, setCreateQuoteDialog] = useState(false);
  const [clientSelection, setClientSelection] = useState<"existing" | "new">("existing");
  const [newQuoteClientId, setNewQuoteClientId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedServices, setSelectedServices] = useState<Array<{
    serviceId: string;
    serviceName: string;
    quantity: string;
    unitPrice: string;
  }>>([]);
  const [newQuotePaymentMethod, setNewQuotePaymentMethod] = useState<"cash" | "wire_transfer" | "card">("wire_transfer");
  const [newQuoteDetails, setNewQuoteDetails] = useState("");
  const [newQuoteWheelCount, setNewQuoteWheelCount] = useState<string>("4");
  const [newQuoteDiameter, setNewQuoteDiameter] = useState("");
  const [newQuoteTaxRate, setNewQuoteTaxRate] = useState("20");
  const [newQuoteProductDetails, setNewQuoteProductDetails] = useState("");
  const [quoteMediaFiles, setQuoteMediaFiles] = useState<Array<{key: string; type: string; name: string}>>([]);
  
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientRole, setNewClientRole] = useState<"client" | "client_professionnel">("client");
  const [newClientCompanyName, setNewClientCompanyName] = useState("");
  const [newClientSiret, setNewClientSiret] = useState("");
  const [newClientTvaNumber, setNewClientTvaNumber] = useState("");
  const [newClientCompanyAddress, setNewClientCompanyAddress] = useState("");

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

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/admin/quotes"],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: services = [] } = useQuery<any[]>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isAdmin,
  });

  // États pour la recherche et les filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fonction pour obtenir le nom complet du client
  const getClientName = (clientId: string) => {
    const client = users.find(u => u.id === clientId);
    if (!client) return `Client-${clientId.slice(0, 8)}`;
    return `${client.firstName || ""} ${client.lastName || ""}`.trim() || client.email;
  };

  // Fonction pour obtenir le nom du service
  const getServiceName = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || `Service-${serviceId.slice(0, 8)}`;
  };

  // Filtrage des devis
  const filteredQuotes = quotes.filter(quote => {
    const clientName = getClientName(quote.clientId).toLowerCase();
    const serviceName = getServiceName(quote.serviceId).toLowerCase();
    const productDetails = (quote.productDetails ?? "").toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = 
      clientName.includes(searchLower) ||
      serviceName.includes(searchLower) ||
      quote.id.toLowerCase().includes(searchLower) ||
      productDetails.includes(searchLower);
    
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleDownloadPDF = async (quote: Quote) => {
    try {
      // Fetch quote items
      const response = await fetch(`/api/admin/quotes/${quote.id}/items`);
      const quoteItems = response.ok ? await response.json() : [];
      
      const service = services.find(s => s.id === quote.serviceId);
      const clientInfo = { 
        name: `Client-${quote.clientId.slice(0, 8)}`,
        email: 'client@myjantes.fr'
      };
      await generateQuotePDF(quote, clientInfo, service, quoteItems);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Échec de la génération du PDF",
        variant: "destructive",
      });
    }
  };

  const handleDownloadLabels = async (quote: Quote) => {
    setSelectedQuoteForLabels(quote);
    setLabelsPreviewOpen(true);
  };

  const handleConfirmDownloadLabels = async () => {
    if (!selectedQuoteForLabels) return;
    
    try {
      await generateLabelsPDF(selectedQuoteForLabels, 'quote');
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

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: { id: string; quoteAmount?: string; notes?: string; status?: string }) => {
      return apiRequest("PATCH", `/api/admin/quotes/${data.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Devis mis à jour avec succès",
      });
      setSelectedQuote(null);
      setQuoteAmount("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la mise à jour du devis",
        variant: "destructive",
      });
    },
  });

  const handleSaveQuote = () => {
    if (!selectedQuote) return;
    
    updateQuoteMutation.mutate({
      id: selectedQuote.id,
      quoteAmount,
      notes,
      status: "approved",
    });
  };

  const handleRejectQuote = (quoteId: string) => {
    updateQuoteMutation.mutate({
      id: quoteId,
      status: "rejected",
    });
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { quoteId: string; clientId: string; amount: string; dueDate: string; notes?: string; mediaFiles?: Array<{key: string; type: string; name: string}> }) => {
      const invoiceNumber = `INV-${Date.now()}`;
      return apiRequest("POST", "/api/admin/invoices", {
        quoteId: data.quoteId,
        clientId: data.clientId,
        invoiceNumber,
        amount: parseFloat(data.amount),
        dueDate: data.dueDate,
        notes: data.notes,
        mediaFiles: data.mediaFiles,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Facture créée avec succès",
      });
      setInvoiceDialog(null);
      setInvoiceDueDate("");
      setInvoiceNotes("");
      setInvoiceMediaFiles([]);
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

  const createReservationMutation = useMutation({
    mutationFn: async (data: { quoteId: string; clientId: string; serviceId: string; scheduledDate: string; notes?: string }) => {
      return apiRequest("POST", "/api/admin/reservations", {
        quoteId: data.quoteId,
        clientId: data.clientId,
        serviceId: data.serviceId,
        scheduledDate: data.scheduledDate,
        status: "confirmed",
        notes: data.notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Réservation créée avec succès",
      });
      setReservationDialog(null);
      setReservationDate("");
      setReservationNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reservations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la création de la réservation",
        variant: "destructive",
      });
    },
  });

  const handleCreateInvoice = () => {
    if (!invoiceDialog || !invoiceDueDate) return;
    
    const imageCount = invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length;
    if (imageCount < 3) {
      toast({
        title: "Erreur",
        description: `Au moins 3 images sont requises (${imageCount}/3)`,
        variant: "destructive",
      });
      return;
    }
    
    createInvoiceMutation.mutate({
      quoteId: invoiceDialog.id,
      clientId: invoiceDialog.clientId,
      amount: invoiceDialog.quoteAmount || "0",
      dueDate: invoiceDueDate,
      notes: invoiceNotes,
      mediaFiles: invoiceMediaFiles,
    });
  };

  const handleCreateReservation = () => {
    if (!reservationDialog || !reservationDate) return;
    createReservationMutation.mutate({
      quoteId: reservationDialog.id,
      clientId: reservationDialog.clientId,
      serviceId: reservationDialog.serviceId,
      scheduledDate: reservationDate,
      notes: reservationNotes,
    });
  };

  const createNewQuoteMutation = useMutation({
    mutationFn: async (data: { 
      clientId: string; 
      serviceId: string; 
      paymentMethod: string; 
      requestDetails?: any; 
      mediaFiles?: Array<{key: string; type: string; name: string}>;
      wheelCount?: number;
      diameter?: string;
      priceExcludingTax?: string;
      taxRate?: string;
      taxAmount?: string;
      productDetails?: string;
      quoteAmount?: string;
      services?: Array<{
        serviceId: string;
        serviceName: string;
        quantity: number;
        unitPrice: number;
      }>;
    }) => {
      return apiRequest("POST", "/api/admin/quotes", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Devis créé avec succès",
      });
      setCreateQuoteDialog(false);
      setClientSelection("existing");
      setNewQuoteClientId("");
      setSelectedServiceId("");
      setSelectedServices([]);
      setNewQuotePaymentMethod("wire_transfer");
      setNewQuoteDetails("");
      setNewQuoteWheelCount("4");
      setNewQuoteDiameter("");
      setNewQuoteTaxRate("20");
      setNewQuoteProductDetails("");
      setQuoteMediaFiles([]);
      setNewClientEmail("");
      setNewClientFirstName("");
      setNewClientLastName("");
      setNewClientRole("client");
      setNewClientCompanyName("");
      setNewClientSiret("");
      setNewClientTvaNumber("");
      setNewClientCompanyAddress("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la création du devis",
        variant: "destructive",
      });
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: { 
      email: string; 
      firstName: string; 
      lastName: string; 
      role: "client" | "client_professionnel";
      companyName?: string;
      siret?: string;
      tvaNumber?: string;
      companyAddress?: string;
    }) => {
      const response = await apiRequest("POST", "/api/admin/clients", data);
      return response;
    },
  });

  const addServiceToQuote = () => {
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

  const removeServiceFromQuote = (index: number) => {
    setSelectedServices(selectedServices.filter((_, i) => i !== index));
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

  const calculateTotalHT = () => {
    return selectedServices.reduce((total, service) => {
      const qty = parseFloat(service.quantity || "0");
      const price = parseFloat(service.unitPrice || "0");
      return total + (qty * price);
    }, 0);
  };

  const calculateTaxAmount = () => {
    const totalHT = calculateTotalHT();
    const taxRate = parseFloat(newQuoteTaxRate || "0");
    return (totalHT * taxRate) / 100;
  };

  const calculateTotalTTC = () => {
    return calculateTotalHT() + calculateTaxAmount();
  };

  const handleCreateNewQuote = async () => {
    // Validation
    if (clientSelection === "new") {
      if (!newClientEmail || !newClientFirstName || !newClientLastName) {
        toast({
          title: "Erreur",
          description: "Email, prénom et nom sont requis pour créer un nouveau client",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!newQuoteClientId) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner un client",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (selectedServices.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins un service",
        variant: "destructive",
      });
      return;
    }
    
    const imageCount = quoteMediaFiles.filter(f => f.type.startsWith('image/')).length;
    if (imageCount < 3) {
      toast({
        title: "Erreur",
        description: `Au moins 3 images sont requises (${imageCount}/3)`,
        variant: "destructive",
      });
      return;
    }
    
    try {
      let clientId = newQuoteClientId;
      
      // Create client if needed
      if (clientSelection === "new") {
        const newClient: any = await createClientMutation.mutateAsync({
          email: newClientEmail,
          firstName: newClientFirstName,
          lastName: newClientLastName,
          role: newClientRole,
          companyName: newClientRole === "client_professionnel" ? newClientCompanyName : undefined,
          siret: newClientRole === "client_professionnel" ? newClientSiret : undefined,
          tvaNumber: newClientRole === "client_professionnel" ? newClientTvaNumber : undefined,
          companyAddress: newClientRole === "client_professionnel" ? newClientCompanyAddress : undefined,
        });
        
        if (!newClient || !newClient.id) {
          throw new Error("Échec de la création du client");
        }
        
        clientId = newClient.id;
        // Invalidate users cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      }
      
      // Calcul du montant TTC avec les services sélectionnés
      const totalHT = calculateTotalHT();
      const taxRate = parseFloat(newQuoteTaxRate) || 0;
      const taxAmount = calculateTaxAmount();
      const totalAmount = calculateTotalTTC();
      
      // Utiliser le premier service comme service principal pour la compatibilité
      const mainServiceId = selectedServices[0].serviceId;
      
      createNewQuoteMutation.mutate({
        clientId,
        serviceId: mainServiceId,
        paymentMethod: newQuotePaymentMethod,
        requestDetails: newQuoteDetails ? { notes: newQuoteDetails } : undefined,
        mediaFiles: quoteMediaFiles,
        wheelCount: parseInt(newQuoteWheelCount),
        diameter: newQuoteDiameter,
        priceExcludingTax: totalHT.toFixed(2),
        taxRate: newQuoteTaxRate,
        taxAmount: taxAmount.toFixed(2),
        productDetails: newQuoteProductDetails,
        quoteAmount: totalAmount.toFixed(2),
        services: selectedServices.map(s => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          quantity: parseFloat(s.quantity),
          unitPrice: parseFloat(s.unitPrice),
        })),
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la création du client ou du devis",
        variant: "destructive",
      });
    }
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
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-admin-quotes-title">Gestion des Devis</h1>
        <Button onClick={() => setCreateQuoteDialog(true)} data-testid="button-create-quote" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Créer un devis
        </Button>
      </div>

      {/* Barre de recherche et filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Tous les Devis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client, service, produits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-quotes"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvés</SelectItem>
                <SelectItem value="rejected">Refusés</SelectItem>
                <SelectItem value="completed">Terminés</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {quotesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{quotes.length === 0 ? "Aucun devis pour le moment" : "Aucun devis ne correspond à votre recherche"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="flex flex-col md:flex-row gap-4 p-4 border border-border rounded-md hover-elevate"
                  data-testid={`admin-quote-item-${quote.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="font-semibold">Devis #{quote.id.slice(0, 8)}</p>
                      <StatusBadge status={quote.status as any} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Client:</span> {getClientName(quote.clientId)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Service:</span> {getServiceName(quote.serviceId)}
                    </p>
                    {quote.wheelCount && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Jantes:</span> {quote.wheelCount} 
                        {quote.diameter && <span> | <span className="font-medium">Diamètre:</span> {quote.diameter}</span>}
                      </p>
                    )}
                    {quote.priceExcludingTax && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Prix HT:</span> {parseFloat(quote.priceExcludingTax).toFixed(2)} € 
                        {quote.taxRate && <span> | <span className="font-medium">TVA:</span> {parseFloat(quote.taxRate).toFixed(0)}%</span>}
                      </p>
                    )}
                    {quote.productDetails && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        <span className="font-medium">Produits:</span> {quote.productDetails}
                      </p>
                    )}
                    {quote.createdAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true, locale: fr })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                    {quote.quoteAmount && (
                      <p className="font-mono font-bold text-lg whitespace-nowrap">{quote.quoteAmount} €</p>
                    )}
                    {quote.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedQuote(quote);
                            setQuoteAmount(quote.quoteAmount || "");
                            setNotes(quote.notes || "");
                          }}
                          data-testid={`button-respond-${quote.id}`}
                        >
                          Répondre
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectQuote(quote.id)}
                          data-testid={`button-reject-${quote.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {quote.status === "approved" && (
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/admin/quotes/${quote.id}/edit`)}
                          data-testid={`button-edit-quote-${quote.id}`}
                        >
                          <Pencil className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Éditer</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadPDF(quote)}
                          data-testid={`button-download-pdf-${quote.id}`}
                        >
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">PDF</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadLabels(quote)}
                          data-testid={`button-download-labels-${quote.id}`}
                        >
                          <Tags className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Étiquettes</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setInvoiceDialog(quote);
                            setInvoiceDueDate(addDays(new Date(), 30).toISOString().split('T')[0]);
                            setInvoiceNotes("");
                          }}
                          data-testid={`button-create-invoice-${quote.id}`}
                        >
                          <FileText className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Facture</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReservationDialog(quote);
                            setReservationDate(addDays(new Date(), 7).toISOString().split('T')[0]);
                            setReservationNotes("");
                          }}
                          data-testid={`button-create-reservation-${quote.id}`}
                        >
                          <Calendar className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Réservation</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Répondre à la Demande de Devis</DialogTitle>
            <DialogDescription>
              Définissez le montant du devis et ajoutez des notes supplémentaires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quote-amount">Montant du Devis ($)</Label>
              <Input
                id="quote-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                className="mt-2"
                data-testid="input-quote-amount"
              />
            </div>
            <div>
              <Label htmlFor="quote-notes">Notes</Label>
              <Textarea
                id="quote-notes"
                placeholder="Ajouter des détails supplémentaires..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                rows={4}
                data-testid="textarea-quote-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedQuote(null)}
              data-testid="button-cancel-quote"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveQuote}
              disabled={updateQuoteMutation.isPending || !quoteAmount}
              data-testid="button-save-quote"
            >
              {updateQuoteMutation.isPending ? "Enregistrement..." : "Enregistrer & Approuver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!invoiceDialog} onOpenChange={(open) => !open && setInvoiceDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Créer une Facture</DialogTitle>
            <DialogDescription>
              Créez une facture basée sur ce devis approuvé.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="invoice-amount">Montant ($)</Label>
              <Input
                id="invoice-amount"
                type="number"
                step="0.01"
                value={invoiceDialog?.quoteAmount || ""}
                disabled
                className="mt-2"
                data-testid="input-invoice-amount"
              />
            </div>
            <div>
              <Label htmlFor="invoice-due-date">Date d'Échéance</Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="mt-2"
                data-testid="input-invoice-due-date"
              />
            </div>
            <div>
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea
                id="invoice-notes"
                placeholder="Notes supplémentaires..."
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="textarea-invoice-notes"
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
                data-testid="uploader-invoice-media"
              />
              {invoiceMediaFiles.length > 0 && invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length < 3 && (
                <p className="text-sm text-destructive mt-2">
                  Au moins 3 images sont requises ({invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length}/3)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInvoiceDialog(null);
                setInvoiceMediaFiles([]);
              }}
              data-testid="button-cancel-invoice"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={
                createInvoiceMutation.isPending || 
                !invoiceDueDate ||
                invoiceMediaFiles.filter(f => f.type.startsWith('image/')).length < 3
              }
              data-testid="button-save-invoice"
            >
              {createInvoiceMutation.isPending ? "Création..." : "Créer Facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reservationDialog} onOpenChange={(open) => !open && setReservationDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une Réservation</DialogTitle>
            <DialogDescription>
              Planifiez une réservation pour ce devis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reservation-date">Date de Réservation</Label>
              <Input
                id="reservation-date"
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="mt-2"
                data-testid="input-reservation-date"
              />
            </div>
            <div>
              <Label htmlFor="reservation-notes">Notes</Label>
              <Textarea
                id="reservation-notes"
                placeholder="Détails de la réservation..."
                value={reservationNotes}
                onChange={(e) => setReservationNotes(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="textarea-reservation-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReservationDialog(null)}
              data-testid="button-cancel-reservation"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateReservation}
              disabled={createReservationMutation.isPending || !reservationDate}
              data-testid="button-save-reservation"
            >
              {createReservationMutation.isPending ? "Création..." : "Créer Réservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createQuoteDialog} onOpenChange={setCreateQuoteDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Créer un Nouveau Devis</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer un nouveau devis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="client-selection">Sélection du client *</Label>
              <Select value={clientSelection} onValueChange={(value: "existing" | "new") => setClientSelection(value)}>
                <SelectTrigger id="client-selection" data-testid="select-client-type">
                  <SelectValue placeholder="Choisir une option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Client existant</SelectItem>
                  <SelectItem value="new">Nouveau client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {clientSelection === "existing" ? (
              <div className="space-y-2">
                <Label htmlFor="new-quote-client">Client *</Label>
                <Select value={newQuoteClientId} onValueChange={setNewQuoteClientId}>
                  <SelectTrigger id="new-quote-client" data-testid="select-new-quote-client">
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
            ) : (
              <div className="p-3 bg-muted rounded-md space-y-4">
                <p className="text-sm font-semibold">Informations du nouveau client</p>
                <NewClientForm
                  email={newClientEmail}
                  setEmail={setNewClientEmail}
                  firstName={newClientFirstName}
                  setFirstName={setNewClientFirstName}
                  lastName={newClientLastName}
                  setLastName={setNewClientLastName}
                  role={newClientRole}
                  setRole={setNewClientRole}
                  companyName={newClientCompanyName}
                  setCompanyName={setNewClientCompanyName}
                  siret={newClientSiret}
                  setSiret={setNewClientSiret}
                  tvaNumber={newClientTvaNumber}
                  setTvaNumber={setNewClientTvaNumber}
                  companyAddress={newClientCompanyAddress}
                  setCompanyAddress={setNewClientCompanyAddress}
                />
                <p className="text-xs text-muted-foreground">
                  Mot de passe par défaut: <span className="font-mono font-semibold">client123</span> (à changer lors de la première connexion)
                </p>
              </div>
            )}
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
                  onClick={addServiceToQuote}
                  disabled={!selectedServiceId}
                  data-testid="button-add-service"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {selectedServices.length > 0 && (
                <div className="border rounded-md p-3 space-y-2">
                  <p className="text-sm font-medium">Services ajoutés:</p>
                  {selectedServices.map((service, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{service.serviceName}</p>
                      </div>
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
                      <span className="text-sm font-mono whitespace-nowrap">
                        {(parseFloat(service.quantity) * parseFloat(service.unitPrice)).toFixed(2)} €
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeServiceFromQuote(index)}
                        className="h-8 w-8"
                        data-testid={`button-remove-service-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="new-quote-payment-method">Moyen de paiement</Label>
              <Select value={newQuotePaymentMethod} onValueChange={(v) => setNewQuotePaymentMethod(v as "cash" | "wire_transfer" | "card")}>
                <SelectTrigger className="mt-2" data-testid="select-new-quote-payment-method">
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
                <Label htmlFor="new-quote-wheel-count">Nombre de jantes</Label>
                <Select value={newQuoteWheelCount} onValueChange={setNewQuoteWheelCount}>
                  <SelectTrigger className="mt-2" data-testid="select-new-quote-wheel-count">
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
                <Label htmlFor="new-quote-diameter">Diamètre</Label>
                <Input
                  id="new-quote-diameter"
                  type="text"
                  placeholder="Ex: 17 pouces"
                  value={newQuoteDiameter}
                  onChange={(e) => setNewQuoteDiameter(e.target.value)}
                  className="mt-2"
                  data-testid="input-new-quote-diameter"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-quote-tax-rate">TVA (%)</Label>
              <Input
                id="new-quote-tax-rate"
                type="number"
                step="0.01"
                placeholder="20"
                value={newQuoteTaxRate}
                onChange={(e) => setNewQuoteTaxRate(e.target.value)}
                className="mt-2"
                data-testid="input-new-quote-tax-rate"
              />
            </div>
            {selectedServices.length > 0 && (
              <div className="p-4 bg-muted rounded-md space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span>Total HT:</span>
                  <span className="font-mono">{calculateTotalHT().toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>TVA ({newQuoteTaxRate}%):</span>
                  <span className="font-mono">{calculateTaxAmount().toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center font-bold text-base pt-2 border-t border-border">
                  <span>Total TTC:</span>
                  <span className="font-mono text-primary">{calculateTotalTTC().toFixed(2)} €</span>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="new-quote-product-details">Détails du produit</Label>
              <Textarea
                id="new-quote-product-details"
                placeholder="Description du produit, références, caractéristiques..."
                value={newQuoteProductDetails}
                onChange={(e) => setNewQuoteProductDetails(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="textarea-new-quote-product-details"
              />
            </div>
            <div>
              <Label htmlFor="new-quote-details">Notes additionnelles (optionnel)</Label>
              <Textarea
                id="new-quote-details"
                placeholder="Notes complémentaires..."
                value={newQuoteDetails}
                onChange={(e) => setNewQuoteDetails(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="textarea-new-quote-details"
              />
            </div>
            <div>
              <Label>Images et Vidéos</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Minimum 3 images requises. Vidéos optionnelles.
              </p>
              <ObjectUploader
                onUploadComplete={(files) => setQuoteMediaFiles(files)}
                accept={{
                  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
                  'video/*': ['.mp4', '.webm', '.mov']
                }}
                data-testid="uploader-quote-media"
              />
              {quoteMediaFiles.length > 0 && quoteMediaFiles.filter(f => f.type.startsWith('image/')).length < 3 && (
                <p className="text-sm text-destructive mt-2">
                  Au moins 3 images sont requises ({quoteMediaFiles.filter(f => f.type.startsWith('image/')).length}/3)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateQuoteDialog(false);
                setQuoteMediaFiles([]);
              }}
              data-testid="button-cancel-new-quote"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateNewQuote}
              disabled={
                createNewQuoteMutation.isPending || 
                createClientMutation.isPending ||
                (isNewClient ? (!newClientEmail || !newClientFirstName || !newClientLastName) : !newQuoteClientId) ||
                selectedServices.length === 0 ||
                quoteMediaFiles.filter(f => f.type.startsWith('image/')).length < 3
              }
              data-testid="button-save-new-quote"
            >
              {(createNewQuoteMutation.isPending || createClientMutation.isPending) ? "Création..." : "Créer Devis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LabelsPreview
        open={labelsPreviewOpen}
        onOpenChange={setLabelsPreviewOpen}
        documentNumber={selectedQuoteForLabels?.id || ""}
        onDownload={handleConfirmDownloadLabels}
        type="quote"
      />
    </div>
  );
}
