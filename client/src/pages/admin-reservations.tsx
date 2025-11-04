import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Reservation, User, Service, Quote } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Plus, Edit, Trash2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminReservations() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  
  // Dialog states
  const [createReservationDialog, setCreateReservationDialog] = useState(false);
  const [editReservationDialog, setEditReservationDialog] = useState(false);
  const [deleteReservationDialog, setDeleteReservationDialog] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  const [reservationType, setReservationType] = useState<"direct" | "from-quote">("direct");
  
  // Form state for direct reservation
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [wheelCount, setWheelCount] = useState<string>("1");
  const [diameter, setDiameter] = useState<string>("");
  const [priceHT, setPriceHT] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("20");
  const [productDetails, setProductDetails] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [reservationStatus, setReservationStatus] = useState<string>("pending");

  // Form state for quote-based reservation
  const [selectedQuote, setSelectedQuote] = useState<string>("");

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

  const { data: reservations = [], isLoading: reservationsLoading } = useQuery<Reservation[]>({
    queryKey: ["/api/admin/reservations"],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/admin/services"],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/admin/quotes"],
    enabled: isAuthenticated && isAdmin,
  });

  const approvedQuotes = quotes.filter(q => q.status === "approved");

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

  // Filtrage des réservations
  const filteredReservations = reservations.filter(reservation => {
    const clientName = getClientName(reservation.clientId).toLowerCase();
    const serviceName = getServiceName(reservation.serviceId).toLowerCase();
    const notes = (reservation.notes ?? "").toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = 
      clientName.includes(searchLower) ||
      serviceName.includes(searchLower) ||
      reservation.id.toLowerCase().includes(searchLower) ||
      notes.includes(searchLower);
    
    const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const createReservationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/reservations", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Réservation créée avec succès",
      });
      resetForm();
      setCreateReservationDialog(false);
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

  const updateReservationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/reservations/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Réservation modifiée avec succès",
      });
      resetForm();
      setEditReservationDialog(false);
      setSelectedReservation(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reservations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la modification de la réservation",
        variant: "destructive",
      });
    },
  });

  const deleteReservationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/reservations/${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Réservation supprimée avec succès",
      });
      setDeleteReservationDialog(false);
      setSelectedReservation(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reservations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la suppression de la réservation",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setReservationType("direct");
    setSelectedClient("");
    setSelectedService("");
    setScheduledDate("");
    setWheelCount("1");
    setDiameter("");
    setPriceHT("");
    setTaxRate("20");
    setProductDetails("");
    setNotes("");
    setSelectedQuote("");
    setReservationStatus("pending");
  };

  const handleCreateReservation = () => {
    if (reservationType === "from-quote") {
      if (!selectedQuote || !scheduledDate) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner un devis et une date",
          variant: "destructive",
        });
        return;
      }

      const quote = quotes.find(q => q.id === selectedQuote);
      if (!quote) {
        toast({
          title: "Erreur",
          description: "Devis introuvable",
          variant: "destructive",
        });
        return;
      }

      createReservationMutation.mutate({
        quoteId: selectedQuote,
        clientId: quote.clientId,
        serviceId: quote.serviceId,
        scheduledDate,
        wheelCount: quote.wheelCount,
        diameter: quote.diameter,
        priceExcludingTax: quote.priceExcludingTax,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        productDetails: quote.productDetails,
        notes: notes || undefined,
        status: reservationStatus,
      });
    } else {
      if (!selectedClient || !selectedService || !scheduledDate) {
        toast({
          title: "Erreur",
          description: "Veuillez remplir tous les champs obligatoires",
          variant: "destructive",
        });
        return;
      }

      const taxRateNum = parseFloat(taxRate);
      const priceHTNum = parseFloat(priceHT || "0");
      const taxAmount = (priceHTNum * taxRateNum / 100).toFixed(2);

      createReservationMutation.mutate({
        clientId: selectedClient,
        serviceId: selectedService,
        scheduledDate,
        wheelCount: parseInt(wheelCount),
        diameter: diameter || undefined,
        priceExcludingTax: priceHT || undefined,
        taxRate: taxRate || undefined,
        taxAmount: taxAmount || undefined,
        productDetails: productDetails || undefined,
        notes: notes || undefined,
        status: reservationStatus,
      });
    }
  };

  const handleEditReservation = () => {
    if (!selectedReservation) return;

    if (!scheduledDate) {
      toast({
        title: "Erreur",
        description: "La date de réservation est obligatoire",
        variant: "destructive",
      });
      return;
    }

    const taxRateNum = parseFloat(taxRate || "20");
    const priceHTNum = parseFloat(priceHT || "0");
    const taxAmount = priceHTNum ? (priceHTNum * taxRateNum / 100).toFixed(2) : undefined;

    updateReservationMutation.mutate({
      id: selectedReservation.id,
      data: {
        scheduledDate,
        wheelCount: wheelCount ? parseInt(wheelCount) : undefined,
        diameter: diameter || undefined,
        priceExcludingTax: priceHT || undefined,
        taxRate: taxRate || undefined,
        taxAmount: taxAmount || undefined,
        productDetails: productDetails || undefined,
        notes: notes || undefined,
        status: reservationStatus,
      },
    });
  };

  const openEditDialog = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setScheduledDate(reservation.scheduledDate ? new Date(reservation.scheduledDate).toISOString().slice(0, 16) : "");
    setWheelCount(reservation.wheelCount?.toString() || "1");
    setDiameter(reservation.diameter || "");
    setPriceHT(reservation.priceExcludingTax || "");
    setTaxRate(reservation.taxRate || "20");
    setProductDetails(reservation.productDetails || "");
    setNotes(reservation.notes || "");
    setReservationStatus(reservation.status);
    setEditReservationDialog(true);
  };

  const openDeleteDialog = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDeleteReservationDialog(true);
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const selectedQuoteDetails = selectedQuote ? quotes.find(q => q.id === selectedQuote) : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-admin-reservations-title">Gestion des Réservations</h1>
        <Button onClick={() => setCreateReservationDialog(true)} data-testid="button-create-reservation" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Créer une réservation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les Réservations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client, service, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-reservations"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">Confirmées</SelectItem>
                <SelectItem value="completed">Terminées</SelectItem>
                <SelectItem value="cancelled">Annulées</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reservationsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{reservations.length === 0 ? "Aucune réservation pour le moment" : "Aucune réservation ne correspond à votre recherche"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex flex-col gap-4 p-4 border border-border rounded-md hover-elevate"
                  data-testid={`reservation-item-${reservation.id}`}
                >
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <p className="font-semibold">Réservation #{reservation.id.slice(0, 8)}</p>
                        <StatusBadge status={reservation.status as any} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Client:</span> {getClientName(reservation.clientId)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Service:</span> {getServiceName(reservation.serviceId)}
                      </p>
                      {reservation.quoteId && (
                        <p className="text-sm text-muted-foreground">Devis: {reservation.quoteId.slice(0, 8)}</p>
                      )}
                      {reservation.wheelCount && (
                        <p className="text-sm text-muted-foreground">Jantes: {reservation.wheelCount} | Diamètre: {reservation.diameter || "N/A"}</p>
                      )}
                      {reservation.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(reservation.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      )}
                    </div>
                    <div className="text-left md:text-right">
                      {reservation.scheduledDate && (
                        <p className="font-medium text-primary">
                          {new Date(reservation.scheduledDate).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      )}
                      {reservation.priceExcludingTax && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Prix HT: {parseFloat(reservation.priceExcludingTax).toFixed(2)} €
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(reservation)}
                      data-testid={`button-edit-reservation-${reservation.id}`}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(reservation)}
                      data-testid={`button-delete-reservation-${reservation.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Reservation Dialog */}
      <Dialog open={createReservationDialog} onOpenChange={(open) => {
        if (!open) resetForm();
        setCreateReservationDialog(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une Réservation</DialogTitle>
            <DialogDescription>
              Créez une nouvelle réservation de service pour un client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Type de réservation</Label>
              <RadioGroup value={reservationType} onValueChange={(v) => setReservationType(v as "direct" | "from-quote")} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="direct" id="direct" data-testid="radio-reservation-direct" />
                  <Label htmlFor="direct" className="font-normal cursor-pointer">Réservation directe</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="from-quote" id="from-quote" data-testid="radio-reservation-from-quote" />
                  <Label htmlFor="from-quote" className="font-normal cursor-pointer">À partir d'un devis approuvé</Label>
                </div>
              </RadioGroup>
            </div>

            {reservationType === "from-quote" ? (
              <>
                <div>
                  <Label htmlFor="selected-quote">Devis approuvé *</Label>
                  <Select value={selectedQuote} onValueChange={setSelectedQuote}>
                    <SelectTrigger className="mt-2" data-testid="select-quote">
                      <SelectValue placeholder="Sélectionner un devis" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedQuotes.map((quote) => (
                        <SelectItem key={quote.id} value={quote.id}>
                          Devis #{quote.id.slice(0, 8)} - {quote.quoteAmount ? `${parseFloat(quote.quoteAmount).toFixed(2)} €` : "N/A"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedQuoteDetails && (
                  <div className="p-4 bg-muted rounded-md space-y-2">
                    <p className="font-semibold">Détails du devis</p>
                    <p className="text-sm">Client: {selectedQuoteDetails.clientId.slice(0, 8)}</p>
                    <p className="text-sm">Service: {selectedQuoteDetails.serviceId.slice(0, 8)}</p>
                    {selectedQuoteDetails.wheelCount && (
                      <p className="text-sm">Jantes: {selectedQuoteDetails.wheelCount} | Diamètre: {selectedQuoteDetails.diameter || "N/A"}</p>
                    )}
                    {selectedQuoteDetails.priceExcludingTax && (
                      <p className="text-sm">Prix HT: {parseFloat(selectedQuoteDetails.priceExcludingTax).toFixed(2)} €</p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="scheduled-date">Date de réservation *</Label>
                  <Input
                    id="scheduled-date"
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-2"
                    data-testid="input-scheduled-date"
                  />
                </div>

                <div>
                  <Label htmlFor="status-quote">Statut</Label>
                  <Select value={reservationStatus} onValueChange={setReservationStatus}>
                    <SelectTrigger className="mt-2" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmée</SelectItem>
                      <SelectItem value="completed">Terminée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes-quote">Notes (optionnel)</Label>
                  <Textarea
                    id="notes-quote"
                    placeholder="Notes supplémentaires..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-2"
                    data-testid="input-notes"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="client">Client *</Label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="mt-2" data-testid="select-client">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => u.role === "client").map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="service">Service *</Label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger className="mt-2" data-testid="select-service">
                      <SelectValue placeholder="Sélectionner un service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.filter(s => s.isActive).map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} {service.basePrice ? `- ${parseFloat(service.basePrice).toFixed(2)} €` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="scheduled-date-direct">Date de réservation *</Label>
                  <Input
                    id="scheduled-date-direct"
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-2"
                    data-testid="input-scheduled-date-direct"
                  />
                </div>

                <div>
                  <Label htmlFor="status-direct">Statut</Label>
                  <Select value={reservationStatus} onValueChange={setReservationStatus}>
                    <SelectTrigger className="mt-2" data-testid="select-status-direct">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmée</SelectItem>
                      <SelectItem value="completed">Terminée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wheel-count">Nombre de jantes</Label>
                    <Select value={wheelCount} onValueChange={setWheelCount}>
                      <SelectTrigger className="mt-2" data-testid="select-wheel-count">
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
                    <Label htmlFor="diameter">Diamètre</Label>
                    <Input
                      id="diameter"
                      type="text"
                      placeholder="ex: 17 pouces"
                      value={diameter}
                      onChange={(e) => setDiameter(e.target.value)}
                      className="mt-2"
                      data-testid="input-diameter"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price-ht">Prix HT (€)</Label>
                    <Input
                      id="price-ht"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={priceHT}
                      onChange={(e) => setPriceHT(e.target.value)}
                      className="mt-2"
                      data-testid="input-price-ht"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tax-rate">Taux TVA (%)</Label>
                    <Input
                      id="tax-rate"
                      type="number"
                      step="0.01"
                      placeholder="20"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="mt-2"
                      data-testid="input-tax-rate"
                    />
                  </div>
                </div>

                {priceHT && taxRate && (
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm font-semibold">Calcul automatique:</p>
                    <p className="text-sm">Prix HT: {parseFloat(priceHT).toFixed(2)} €</p>
                    <p className="text-sm">TVA ({taxRate}%): {(parseFloat(priceHT) * parseFloat(taxRate) / 100).toFixed(2)} €</p>
                    <p className="text-sm font-semibold">Prix TTC: {(parseFloat(priceHT) * (1 + parseFloat(taxRate) / 100)).toFixed(2)} €</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="product-details">Détails produit</Label>
                  <Textarea
                    id="product-details"
                    placeholder="Détails sur les produits et services..."
                    value={productDetails}
                    onChange={(e) => setProductDetails(e.target.value)}
                    className="mt-2"
                    rows={3}
                    data-testid="input-product-details"
                  />
                </div>

                <div>
                  <Label htmlFor="notes-direct">Notes (optionnel)</Label>
                  <Textarea
                    id="notes-direct"
                    placeholder="Notes supplémentaires..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-2"
                    data-testid="input-notes-direct"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setCreateReservationDialog(false);
              }}
              data-testid="button-cancel-create-reservation"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateReservation}
              disabled={createReservationMutation.isPending}
              data-testid="button-save-reservation"
            >
              {createReservationMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reservation Dialog */}
      <Dialog open={editReservationDialog} onOpenChange={(open) => {
        if (!open) {
          resetForm();
          setSelectedReservation(null);
        }
        setEditReservationDialog(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la Réservation</DialogTitle>
            <DialogDescription>
              Modifiez les détails de cette réservation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="edit-scheduled-date">Date de réservation *</Label>
              <Input
                id="edit-scheduled-date"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-2"
                data-testid="input-edit-scheduled-date"
              />
            </div>

            <div>
              <Label htmlFor="edit-status">Statut</Label>
              <Select value={reservationStatus} onValueChange={setReservationStatus}>
                <SelectTrigger className="mt-2" data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmée</SelectItem>
                  <SelectItem value="completed">Terminée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-wheel-count">Nombre de jantes</Label>
                <Select value={wheelCount} onValueChange={setWheelCount}>
                  <SelectTrigger className="mt-2" data-testid="select-edit-wheel-count">
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
                <Label htmlFor="edit-diameter">Diamètre</Label>
                <Input
                  id="edit-diameter"
                  type="text"
                  placeholder="ex: 17 pouces"
                  value={diameter}
                  onChange={(e) => setDiameter(e.target.value)}
                  className="mt-2"
                  data-testid="input-edit-diameter"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price-ht">Prix HT (€)</Label>
                <Input
                  id="edit-price-ht"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={priceHT}
                  onChange={(e) => setPriceHT(e.target.value)}
                  className="mt-2"
                  data-testid="input-edit-price-ht"
                />
              </div>

              <div>
                <Label htmlFor="edit-tax-rate">Taux TVA (%)</Label>
                <Input
                  id="edit-tax-rate"
                  type="number"
                  step="0.01"
                  placeholder="20"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="mt-2"
                  data-testid="input-edit-tax-rate"
                />
              </div>
            </div>

            {priceHT && taxRate && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm font-semibold">Calcul automatique:</p>
                <p className="text-sm">Prix HT: {parseFloat(priceHT).toFixed(2)} €</p>
                <p className="text-sm">TVA ({taxRate}%): {(parseFloat(priceHT) * parseFloat(taxRate) / 100).toFixed(2)} €</p>
                <p className="text-sm font-semibold">Prix TTC: {(parseFloat(priceHT) * (1 + parseFloat(taxRate) / 100)).toFixed(2)} €</p>
              </div>
            )}

            <div>
              <Label htmlFor="edit-product-details">Détails produit</Label>
              <Textarea
                id="edit-product-details"
                placeholder="Détails sur les produits et services..."
                value={productDetails}
                onChange={(e) => setProductDetails(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="input-edit-product-details"
              />
            </div>

            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Notes supplémentaires..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setSelectedReservation(null);
                setEditReservationDialog(false);
              }}
              data-testid="button-cancel-edit-reservation"
            >
              Annuler
            </Button>
            <Button
              onClick={handleEditReservation}
              disabled={updateReservationMutation.isPending}
              data-testid="button-save-edit-reservation"
            >
              {updateReservationMutation.isPending ? "Modification..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Reservation Confirmation Dialog */}
      <AlertDialog open={deleteReservationDialog} onOpenChange={setDeleteReservationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette réservation ? Cette action est irréversible.
              {selectedReservation && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="font-semibold text-foreground">Réservation #{selectedReservation.id.slice(0, 8)}</p>
                  {selectedReservation.scheduledDate && (
                    <p className="text-sm text-foreground">
                      Date: {new Date(selectedReservation.scheduledDate).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-reservation">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedReservation) {
                  deleteReservationMutation.mutate(selectedReservation.id);
                }
              }}
              disabled={deleteReservationMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-reservation"
            >
              {deleteReservationMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
