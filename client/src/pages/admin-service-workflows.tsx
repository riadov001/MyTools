import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit } from "lucide-react";
import type { Service, Workflow, WorkflowStep } from "@shared/schema";

export default function AdminServiceWorkflows() {
  const { toast } = useToast();
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState({ name: "", description: "" });
  const [stepForm, setStepForm] = useState({ title: "", description: "", stepNumber: 1 });

  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/admin/services"] });
  const { data: workflows = [] } = useQuery<Workflow[]>({ queryKey: ["/api/admin/workflows"] });
  const { data: serviceWorkflows = [] } = useQuery<Workflow[]>({
    queryKey: ["/api/admin/services", selectedServiceId, "workflows"],
    enabled: !!selectedServiceId,
  });
  const { data: workflowSteps = [] } = useQuery<WorkflowStep[]>({
    queryKey: ["/api/admin/workflows", selectedWorkflowId, "steps"],
    enabled: !!selectedWorkflowId,
  });

  const createWorkflowMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingWorkflowId) {
        return apiRequest("PATCH", `/api/admin/workflows/${editingWorkflowId}`, data);
      }
      return apiRequest("POST", "/api/admin/workflows", data);
    },
    onSuccess: () => {
      const message = editingWorkflowId ? "Le workflow a été mis à jour" : "Le workflow a été créé avec succès";
      toast({ title: "Succès", description: message });
      setIsWorkflowDialogOpen(false);
      setEditingWorkflowId(null);
      setWorkflowForm({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflows"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/workflows/${id}`),
    onSuccess: () => {
      toast({ title: "Succès", description: "Workflow supprimé" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflows"] });
      if (selectedWorkflowId === selectedWorkflowId) setSelectedWorkflowId("");
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createStepMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingStepId) {
        return apiRequest("PATCH", `/api/admin/workflow-steps/${editingStepId}`, data);
      }
      return apiRequest("POST", "/api/admin/workflow-steps", data);
    },
    onSuccess: () => {
      const message = editingStepId ? "L'étape a été mise à jour" : "L'étape a été créée avec succès";
      toast({ title: "Succès", description: message });
      setIsStepDialogOpen(false);
      setEditingStepId(null);
      setStepForm({ title: "", description: "", stepNumber: 1 });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflows", selectedWorkflowId, "steps"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteStepMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/workflow-steps/${id}`),
    onSuccess: () => {
      toast({ title: "Succès", description: "Étape supprimée" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflows", selectedWorkflowId, "steps"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const deleteServiceWorkflowMutation = useMutation({
    mutationFn: ({ serviceId, workflowId }: any) => apiRequest("DELETE", `/api/admin/services/${serviceId}/workflows/${workflowId}`),
    onSuccess: () => {
      toast({ title: "Succès", description: "Workflow désassigné" });
      setSelectedWorkflowId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", selectedServiceId, "workflows"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const assignWorkflowMutation = useMutation({
    mutationFn: ({ serviceId, workflowId }: any) => 
      apiRequest("POST", `/api/admin/services/${serviceId}/workflows`, { workflowId }),
    onSuccess: () => {
      toast({ title: "Workflow assigné", description: "Le workflow a été assigné au service" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", selectedServiceId, "workflows"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const selectedService = services.find(s => s.id === selectedServiceId);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Workflows par Service</h1>

      <Card>
        <CardHeader>
          <CardTitle>Créer un Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setIsWorkflowDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Workflow
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sélectionner un Service</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un service" />
            </SelectTrigger>
            <SelectContent>
              {services.map(service => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedService && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Workflows assignés à {selectedService.name}</CardTitle>
              <Button 
                size="sm"
                onClick={() => setIsStepDialogOpen(false)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Assigner Workflow
              </Button>
            </CardHeader>
            <CardContent>
              {serviceWorkflows.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Aucun workflow assigné. Choisissez un workflow existant:</p>
                  <Select defaultValue="" onValueChange={(wfId) => {
                    assignWorkflowMutation.mutate({ serviceId: selectedServiceId, workflowId: wfId });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un workflow" />
                    </SelectTrigger>
                    <SelectContent>
                      {workflows.map(wf => (
                        <SelectItem key={wf.id} value={wf.id}>
                          {wf.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  {serviceWorkflows.map(wf => (
                    <div key={wf.id} className="flex items-center justify-between p-3 border rounded-md hover-elevate">
                      <div className="flex-1 cursor-pointer" onClick={() => setSelectedWorkflowId(wf.id)}>
                        <p className="font-medium">{wf.name}</p>
                        <p className="text-xs text-muted-foreground">{wf.description}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Êtes-vous sûr de vouloir désassigner ce workflow?")) {
                            deleteServiceWorkflowMutation.mutate({ serviceId: selectedServiceId, workflowId: wf.id });
                          }
                        }}
                        disabled={deleteServiceWorkflowMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedWorkflowId && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Étapes du Workflow</CardTitle>
                <Button size="sm" onClick={() => setIsStepDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Étape
                </Button>
              </CardHeader>
              <CardContent>
                {workflowSteps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune étape définie. Créez la première étape.</p>
                ) : (
                  <div className="space-y-2">
                    {workflowSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 border rounded-md">
                        <Badge>{step.stepNumber}</Badge>
                        <div className="flex-1">
                          <p className="font-medium">{step.title}</p>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingStepId(step.id);
                              setStepForm({
                                title: step.title,
                                description: step.description || "",
                                stepNumber: step.stepNumber,
                              });
                              setIsStepDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm("Êtes-vous sûr de vouloir supprimer cette étape?")) {
                                deleteStepMutation.mutate(step.id);
                              }
                            }}
                            disabled={deleteStepMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du Workflow</Label>
              <Input
                value={workflowForm.name}
                onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                placeholder="ex. Changement de pneus"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={workflowForm.description}
                onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                placeholder="Décrivez le workflow..."
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsWorkflowDialogOpen(false);
              setEditingWorkflowId(null);
              setWorkflowForm({ name: "", description: "" });
            }}>Annuler</Button>
            {editingWorkflowId && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Êtes-vous sûr?")) {
                    deleteWorkflowMutation.mutate(editingWorkflowId);
                    setIsWorkflowDialogOpen(false);
                    setEditingWorkflowId(null);
                  }
                }}
                disabled={deleteWorkflowMutation.isPending}
              >
                Supprimer
              </Button>
            )}
            <Button
              onClick={() => createWorkflowMutation.mutate(workflowForm)}
              disabled={createWorkflowMutation.isPending || !workflowForm.name}
            >
              {createWorkflowMutation.isPending ? "Enregistrement..." : editingWorkflowId ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStepDialogOpen} onOpenChange={(open) => {
        setIsStepDialogOpen(open);
        if (!open) {
          setEditingStepId(null);
          setStepForm({ title: "", description: "", stepNumber: 1 });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStepId ? "Modifier l'Étape" : "Ajouter une Étape"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Numéro de l'étape</Label>
              <Input
                type="number"
                value={stepForm.stepNumber}
                onChange={(e) => setStepForm({ ...stepForm, stepNumber: parseInt(e.target.value) })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Titre de l'étape</Label>
              <Input
                value={stepForm.title}
                onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                placeholder="ex. Retirer les pneus"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={stepForm.description}
                onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                placeholder="Décrivez l'étape..."
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsStepDialogOpen(false);
              setEditingStepId(null);
              setStepForm({ title: "", description: "", stepNumber: 1 });
            }}>Annuler</Button>
            {editingStepId && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Êtes-vous sûr?")) {
                    deleteStepMutation.mutate(editingStepId);
                    setIsStepDialogOpen(false);
                    setEditingStepId(null);
                  }
                }}
                disabled={deleteStepMutation.isPending}
              >
                Supprimer
              </Button>
            )}
            <Button
              onClick={() => createStepMutation.mutate({ ...stepForm, workflowId: selectedWorkflowId })}
              disabled={createStepMutation.isPending || !stepForm.title}
            >
              {createStepMutation.isPending ? "Enregistrement..." : editingStepId ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
