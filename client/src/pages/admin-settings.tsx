import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Users, Shield, User as UserIcon, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, ApplicationSettings } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertApplicationSettingsSchema } from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const formSchema = insertApplicationSettingsSchema.extend({
  defaultWheelCount: z.coerce.number().min(1).max(4),
  defaultTaxRate: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: "Le taux de TVA doit être un nombre",
  }),
});

export default function AdminSettings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

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

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<ApplicationSettings>({
    queryKey: ["/api/admin/settings"],
    enabled: isAuthenticated && isAdmin,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      defaultWheelCount: 4,
      defaultDiameter: "17",
      defaultTaxRate: "20.00",
      wheelCountOptions: "1,2,3,4",
      diameterOptions: "14,15,16,17,18,19,20,21,22",
      companyName: "MyJantes",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      companySiret: "",
      companyTvaNumber: "",
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset({
        defaultWheelCount: settings.defaultWheelCount,
        defaultDiameter: settings.defaultDiameter,
        defaultTaxRate: settings.defaultTaxRate,
        wheelCountOptions: settings.wheelCountOptions,
        diameterOptions: settings.diameterOptions,
        companyName: settings.companyName,
        companyAddress: settings.companyAddress || "",
        companyPhone: settings.companyPhone || "",
        companyEmail: settings.companyEmail || "",
        companySiret: settings.companySiret || "",
        companyTvaNumber: settings.companyTvaNumber || "",
      });
    }
  }, [settings, form]);

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "client" | "admin" }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Rôle de l'utilisateur mis à jour",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la mise à jour du rôle",
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return apiRequest("PATCH", "/api/admin/settings", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Paramètres mis à jour avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la mise à jour des paramètres",
        variant: "destructive",
      });
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/cache/clear", {});
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Cache vidé avec succès",
      });
      // Clear local cache
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }
      // Invalidate all queries to force refresh
      queryClient.clear();
      // Reload current page
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec du vidage du cache",
        variant: "destructive",
      });
    },
  });

  const handleToggleRole = (user: User) => {
    const newRole = user.role === "admin" ? "client" : "admin";
    updateUserRoleMutation.mutate({ userId: user.id, role: newRole });
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const adminUsers = users.filter((u) => u.role === "admin");
  const clientUsers = users.filter((u) => u.role === "client");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-admin-settings-title">Paramètres & Utilisateurs</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Gestion des Utilisateurs</CardTitle>
          </div>
          <CardDescription>Gérez les rôles et permissions des utilisateurs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {usersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <>
              {/* Administrateurs */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Administrateurs ({adminUsers.length})
                </h3>
                <div className="space-y-2">
                  {adminUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun administrateur</p>
                  ) : (
                    adminUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-border rounded-lg hover-elevate"
                        data-testid={`user-item-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Shield className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:shrink-0">
                          <Badge variant="default" data-testid={`badge-role-${user.id}`}>
                            Admin
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleRole(user)}
                            disabled={updateUserRoleMutation.isPending}
                            data-testid={`button-toggle-role-${user.id}`}
                          >
                            Rétrograder
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Clients */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  Clients ({clientUsers.length})
                </h3>
                <div className="space-y-2">
                  {clientUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun client</p>
                  ) : (
                    clientUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-border rounded-lg hover-elevate"
                        data-testid={`user-item-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <UserIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:shrink-0">
                          <Badge variant="secondary" data-testid={`badge-role-${user.id}`}>
                            Client
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleRole(user)}
                            disabled={updateUserRoleMutation.isPending}
                            data-testid={`button-toggle-role-${user.id}`}
                          >
                            Promouvoir
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Paramètres de l'Application</CardTitle>
          </div>
          <CardDescription>Configurez votre application MyJantes</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Paramètres par défaut */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Paramètres par défaut</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="defaultWheelCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de jantes par défaut</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={4}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              data-testid="input-default-wheel-count"
                            />
                          </FormControl>
                          <FormDescription>1 à 4 jantes</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultDiameter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diamètre par défaut</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-default-diameter" />
                          </FormControl>
                          <FormDescription>Ex: 17</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultTaxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taux de TVA par défaut (%)</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-default-tax-rate" />
                          </FormControl>
                          <FormDescription>Ex: 20.00</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="wheelCountOptions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Options de nombre de jantes</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-wheel-count-options" />
                          </FormControl>
                          <FormDescription>Séparées par des virgules (ex: 1,2,3,4)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="diameterOptions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Options de diamètres disponibles</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-diameter-options" />
                          </FormControl>
                          <FormDescription>Séparées par des virgules</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Informations de l'entreprise */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Informations de l'entreprise</h3>
                  
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'entreprise</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="companyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-company-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} data-testid="input-company-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="email" data-testid="input-company-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companySiret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SIRET</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} maxLength={14} data-testid="input-company-siret" />
                          </FormControl>
                          <FormDescription>14 chiffres</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyTvaNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro de TVA</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} data-testid="input-company-tva" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="flex-1 sm:flex-initial"
                    data-testid="button-save-settings"
                  >
                    {updateSettingsMutation.isPending ? "Enregistrement..." : "Enregistrer les paramètres"}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => clearCacheMutation.mutate()}
                    disabled={clearCacheMutation.isPending}
                    className="flex-1 sm:flex-initial"
                    data-testid="button-clear-cache"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {clearCacheMutation.isPending ? "Vidage..." : "Vider le cache"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
