import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AdminUsers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [createUserDialog, setCreateUserDialog] = useState(false);
  const [editUserDialog, setEditUserDialog] = useState<User | null>(null);
  const [deleteUserDialog, setDeleteUserDialog] = useState<User | null>(null);
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"client" | "client_professionnel" | "employe" | "admin">("client");

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState<"client" | "client_professionnel" | "employe" | "admin">("client");

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

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; firstName?: string; lastName?: string; role?: "client" | "client_professionnel" | "employe" | "admin" }) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Utilisateur créé avec succès",
      });
      setCreateUserDialog(false);
      setNewUserEmail("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserRole("client");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la création de l'utilisateur",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; firstName?: string; lastName?: string; role?: "client" | "client_professionnel" | "employe" | "admin" }) => {
      return apiRequest("PATCH", `/api/admin/users/${data.id}`, {
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Utilisateur modifié avec succès",
      });
      setEditUserDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la modification de l'utilisateur",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Utilisateur supprimé avec succès",
      });
      setDeleteUserDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la suppression de l'utilisateur",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUserEmail) {
      toast({
        title: "Erreur",
        description: "L'email est requis",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      email: newUserEmail,
      firstName: newUserFirstName || undefined,
      lastName: newUserLastName || undefined,
      role: newUserRole,
    });
  };

  const handleUpdateUser = () => {
    if (!editUserDialog) return;

    updateUserMutation.mutate({
      id: editUserDialog.id,
      firstName: editFirstName || undefined,
      lastName: editLastName || undefined,
      role: editRole,
    });
  };

  const handleDeleteUser = () => {
    if (!deleteUserDialog) return;
    deleteUserMutation.mutate(deleteUserDialog.id);
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
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-admin-users-title">Gestion des Utilisateurs</h1>
        <Button onClick={() => setCreateUserDialog(true)} data-testid="button-create-user" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Créer un utilisateur
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucun utilisateur pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col md:flex-row gap-4 p-4 border border-border rounded-md hover-elevate"
                  data-testid={`admin-user-item-${user.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="font-semibold">{user.firstName} {user.lastName}</p>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} data-testid={`badge-role-${user.id}`}>
                        {user.role === "admin" ? "Admin" : user.role === "employe" ? "Employé" : user.role === "client_professionnel" ? "Client Pro" : "Client"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">ID: {user.id}</p>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditUserDialog(user);
                        setEditFirstName(user.firstName || "");
                        setEditLastName(user.lastName || "");
                        setEditRole(user.role);
                      }}
                      data-testid={`button-edit-${user.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteUserDialog(user)}
                      data-testid={`button-delete-${user.id}`}
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

      <Dialog open={createUserDialog} onOpenChange={setCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un Utilisateur</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer un nouveau compte utilisateur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-user-email">Email *</Label>
              <Input
                id="new-user-email"
                type="email"
                placeholder="utilisateur@exemple.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="mt-2"
                data-testid="input-new-user-email"
              />
            </div>
            <div>
              <Label htmlFor="new-user-first-name">Prénom</Label>
              <Input
                id="new-user-first-name"
                type="text"
                placeholder="Jean"
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
                className="mt-2"
                data-testid="input-new-user-first-name"
              />
            </div>
            <div>
              <Label htmlFor="new-user-last-name">Nom</Label>
              <Input
                id="new-user-last-name"
                type="text"
                placeholder="Dupont"
                value={newUserLastName}
                onChange={(e) => setNewUserLastName(e.target.value)}
                className="mt-2"
                data-testid="input-new-user-last-name"
              />
            </div>
            <div>
              <Label htmlFor="new-user-role">Rôle</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as "client" | "client_professionnel" | "employe" | "admin")}>
                <SelectTrigger className="mt-2" data-testid="select-new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="client_professionnel">Client Professionnel</SelectItem>
                  <SelectItem value="employe">Employé</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateUserDialog(false);
                setNewUserEmail("");
                setNewUserFirstName("");
                setNewUserLastName("");
                setNewUserRole("client");
              }}
              data-testid="button-cancel-create-user"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending || !newUserEmail}
              data-testid="button-save-new-user"
            >
              {createUserMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUserDialog} onOpenChange={(open) => !open && setEditUserDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'Utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'utilisateur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-user-first-name">Prénom</Label>
              <Input
                id="edit-user-first-name"
                type="text"
                placeholder="Jean"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className="mt-2"
                data-testid="input-edit-user-first-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-user-last-name">Nom</Label>
              <Input
                id="edit-user-last-name"
                type="text"
                placeholder="Dupont"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className="mt-2"
                data-testid="input-edit-user-last-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-user-role">Rôle</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as "client" | "client_professionnel" | "employe" | "admin")}>
                <SelectTrigger className="mt-2" data-testid="select-edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="client_professionnel">Client Professionnel</SelectItem>
                  <SelectItem value="employe">Employé</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditUserDialog(null)}
              data-testid="button-cancel-edit-user"
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-edit-user"
            >
              {updateUserMutation.isPending ? "Modification..." : "Modifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserDialog} onOpenChange={(open) => !open && setDeleteUserDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'utilisateur {deleteUserDialog?.firstName} {deleteUserDialog?.lastName} ({deleteUserDialog?.email}) sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete-user"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
