import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Service } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Services() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [requestDetails, setRequestDetails] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wire_transfer" | "card">("wire_transfer");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Non autorisé",
        description: "Vous êtes déconnecté. Reconnexion...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated,
  });

  const requestQuoteMutation = useMutation({
    mutationFn: async (data: { serviceId: string; paymentMethod: "cash" | "wire_transfer" | "card"; requestDetails: any }) => {
      return apiRequest("POST", "/api/quotes", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Demande de devis soumise avec succès",
      });
      setSelectedService(null);
      setRequestDetails("");
      setPaymentMethod("wire_transfer");
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non autorisé",
          description: "Vous êtes déconnecté. Reconnexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: error.message || "Échec de la soumission de la demande de devis",
        variant: "destructive",
      });
    },
  });

  const handleRequestQuote = () => {
    if (!selectedService) return;
    
    requestQuoteMutation.mutate({
      serviceId: selectedService.id,
      paymentMethod,
      requestDetails: { message: requestDetails },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-services-title">Nos Services</h1>
        <p className="text-muted-foreground">Parcourez nos services et demandez un devis</p>
      </div>

      {servicesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">Aucun service disponible pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card key={service.id} className="flex flex-col hover-elevate" data-testid={`service-card-${service.id}`}>
              <CardHeader>
                <CardTitle>{service.name}</CardTitle>
                {service.category && (
                  <CardDescription className="uppercase text-xs tracking-wide">
                    {service.category}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground">{service.description || "Aucune description disponible"}</p>
                {service.basePrice && (
                  <p className="text-xl font-bold font-mono mt-4">
                    À partir de ${service.basePrice}
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => setSelectedService(service)}
                  data-testid={`button-request-quote-${service.id}`}
                >
                  Demander un Devis
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un Devis</DialogTitle>
            <DialogDescription>
              Fournir les détails pour votre demande de service {selectedService?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-method">Moyen de Paiement</Label>
              <Select value={paymentMethod} onValueChange={(value: "cash" | "wire_transfer" | "card") => setPaymentMethod(value)}>
                <SelectTrigger id="payment-method" className="mt-2" data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="wire_transfer">Virement</SelectItem>
                  <SelectItem value="card">Carte bleue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="request-details">Détails de la Demande</Label>
              <Textarea
                id="request-details"
                placeholder="Décrivez vos besoins..."
                value={requestDetails}
                onChange={(e) => setRequestDetails(e.target.value)}
                className="mt-2"
                rows={6}
                data-testid="textarea-request-details"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedService(null)}
              data-testid="button-cancel-request"
            >
              Annuler
            </Button>
            <Button
              onClick={handleRequestQuote}
              disabled={requestQuoteMutation.isPending || !requestDetails.trim()}
              data-testid="button-submit-request"
            >
              {requestQuoteMutation.isPending ? "Envoi..." : "Soumettre la Demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
