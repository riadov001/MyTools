import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, Calendar, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Quote, Invoice, Reservation } from "@shared/schema";

interface Engagement {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

interface EngagementData {
  quotes: Quote[];
  invoices: Invoice[];
  reservations: Reservation[];
}

export default function AdminEngagements() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: engagements = [] } = useQuery<Engagement[]>({
    queryKey: ["/api/admin/engagements"],
  });

  const { data: engagementData } = useQuery<EngagementData>({
    queryKey: ["/api/admin/engagements/summary", selectedClientId],
    enabled: !!selectedClientId,
  });

  const handleDeleteEngagement = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette prestation ?")) return;
    try {
      await apiRequest("DELETE", `/api/admin/engagements/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/engagements"] });
    } catch (error) {
      console.error("Error deleting engagement:", error);
    }
  };

  const selectedClient = users.find((u) => u.id === selectedClientId);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-admin-engagements-title">
          Gestion des Prestations
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sélectionner un Client</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger data-testid="select-client-engagement">
              <SelectValue placeholder="Sélectionner un client" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((u) => u.role === "client" || u.role === "client_professionnel")
                .map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClient && engagementData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quotes Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Devis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{engagementData.quotes.length}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {engagementData.quotes.filter((q) => q.status === "approved").length} approuvés
              </p>
            </CardContent>
          </Card>

          {/* Invoices Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4" />
                Factures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{engagementData.invoices.length}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {engagementData.invoices.filter((i) => i.status === "paid").length} payées
              </p>
            </CardContent>
          </Card>

          {/* Reservations Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                Réservations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{engagementData.reservations.length}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {engagementData.reservations.filter((r) => r.status === "confirmed").length} confirmées
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Engagements List */}
      <Card>
        <CardHeader>
          <CardTitle>Toutes les Prestations</CardTitle>
        </CardHeader>
        <CardContent>
          {engagements.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune prestation créée</p>
          ) : (
            <div className="space-y-3">
              {engagements.map((engagement) => {
                const client = users.find((u) => u.id === engagement.clientId);
                return (
                  <div
                    key={engagement.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md hover-elevate"
                    data-testid={`card-engagement-${engagement.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{engagement.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {client?.firstName} {client?.lastName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          engagement.status === "active"
                            ? "default"
                            : engagement.status === "completed"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {engagement.status === "active"
                          ? "Actif"
                          : engagement.status === "completed"
                            ? "Complété"
                            : "Annulé"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteEngagement(engagement.id)}
                        data-testid="button-delete-engagement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
