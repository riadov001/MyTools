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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      setSelectedWorkflowId("");
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", selectedServiceId, "workflows"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const assignWorkflowMutation = useMutation({
    mutationFn: ({ serviceId, workflowId }: any) => 
      apiRequest("POST", `/api/admin/services/${serviceId}/workflows`, { workflowId }),
    onSuccess: () => {
      toast({ title: "Succès", description: "Workflow assigné au service" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services", selectedServiceId, "workflows"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
  const availableWorkflows = workflows.filter(w => !serviceWorkflows.some(sw => sw.id === w.id));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Workflows Atelier</h1>

      <Tabs defaultValue="workflows" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="workflows">Workflows Globaux</TabsTrigger>
          <TabsTrigger value="services">Assigner aux Services</TabsTrigger>
        </TabsList>

        {/* SECTION 1: WORKFLOWS GLOBAUX */}
        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gérer les Workflows</CardTitle>
              <Button onClick={() => {
                setEditingWorkflowId(null);
                setWorkflowForm({ name: "", description: "" });
                setIsWorkflowDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Workflow
              </Button>
            </CardHeader>
            <CardContent>
              {workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun workflow créé. Créez le premier!</p>
              ) : (
                <div className="space-y-2">
                  {workflows.map(workflow => (
                    <div 
                      key={workflow.id} 
                      className={`p-4 border rounded-md hover-elevate cursor-pointer transition ${selectedWorkflowId === workflow.id ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedWorkflowId(workflow.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold">{workflow.name}</p>
                          <p className="text-sm text-muted-foreground">{workflow.description}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingWorkflowId(workflow.id);
                              setWorkflowForm({
                                name: workflow.name,
                                description: workflow.description || "",
                              });
                              setIsWorkflowDialogOpen(true);
                            }}
                            data-testid="button-edit-workflow"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Êtes-vous sûr de vouloir supprimer ce workflow?")) {
                                deleteWorkflowMutation.mutate(workflow.id);
                              }
                            }}
                            disabled={deleteWorkflowMutation.isPending}
                            data-testid="button-delete-workflow"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedWorkflowId && selectedWorkflow && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Étapes du Workflow: {selectedWorkflow.name}</CardTitle>
                <Button size="sm" onClick={() => {
                  setEditingStepId(null);
                  setStepForm({ title: "", description: "", stepNumber: (workflowSteps.length || 0) + 1 });
                  setIsStepDialogOpen(true);
                }} data-testid="button-add-step">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Étape
                </Button>
              </CardHeader>
              <CardContent>
                {workflowSteps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune étape. Créez la première étape!</p>
                ) : (
                  <div className="space-y-2">
                    {workflowSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 border rounded-md">
                        <Badge className="flex-shrink-0">{step.stepNumber}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium break-words">{step.title}</p>
                          <p className="text-xs text-muted-foreground break-words">{step.description}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
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
                            data-testid="button-edit-step"
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
                            data-testid="button-delete-step"
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
        </TabsContent>

        {/* SECTION 2: ASSIGNER AUX SERVICES */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sélectionner un Service</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger data-testid="select-service">
                  <SelectValue placeholder="Sélectionner un service..." />
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
                <CardHeader>
                  <CardTitle>Workflows assignés à {selectedService.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {serviceWorkflows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun workflow assigné. Ajoutez un workflow ci-dessous.</p>
                  ) : (
                    <div className="space-y-2">
                      {serviceWorkflows.map(wf => (
                        <div key={wf.id} className="flex items-center justify-between p-3 border rounded-md hover-elevate">
                          <div className="flex-1">
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
                            data-testid="button-unassign-workflow"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {availableWorkflows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Ajouter un Workflow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select defaultValue="" onValueChange={(wfId) => {
                      if (wfId) {
                        assignWorkflowMutation.mutate({ serviceId: selectedServiceId, workflowId: wfId });
                      }
                    }}>
                      <SelectTrigger data-testid="select-workflow-to-assign">
                        <SelectValue placeholder="Sélectionner un workflow..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableWorkflows.map(wf => (
                          <SelectItem key={wf.id} value={wf.id}>
                            {wf.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* WORKFLOW DIALOG */}
      <Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWorkflowId ? "Modifier le Workflow" : "Créer un Workflow"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow-name">Nom du Workflow</Label>
              <Input
                id="workflow-name"
                value={workflowForm.name}
                onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                placeholder="ex. Rénovation"
                className="mt-2"
                data-testid="input-workflow-name"
              />
            </div>
            <div>
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={workflowForm.description}
                onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                placeholder="Décrivez le workflow..."
                className="mt-2"
                rows={3}
                data-testid="textarea-workflow-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsWorkflowDialogOpen(false);
              setEditingWorkflowId(null);
              setWorkflowForm({ name: "", description: "" });
            }} data-testid="button-cancel-workflow">Annuler</Button>
            {editingWorkflowId && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Êtes-vous sûr de vouloir supprimer ce workflow?")) {
                    deleteWorkflowMutation.mutate(editingWorkflowId);
                    setIsWorkflowDialogOpen(false);
                    setEditingWorkflowId(null);
                  }
                }}
                disabled={deleteWorkflowMutation.isPending}
                data-testid="button-delete-workflow-dialog"
              >
                Supprimer
              </Button>
            )}
            <Button
              onClick={() => createWorkflowMutation.mutate(workflowForm)}
              disabled={createWorkflowMutation.isPending || !workflowForm.name}
              data-testid="button-save-workflow"
            >
              {createWorkflowMutation.isPending ? "Enregistrement..." : editingWorkflowId ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STEP DIALOG */}
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
              <Label htmlFor="step-number">Numéro de l'étape</Label>
              <Input
                id="step-number"
                type="number"
                value={stepForm.stepNumber}
                onChange={(e) => setStepForm({ ...stepForm, stepNumber: parseInt(e.target.value) || 1 })}
                className="mt-2"
                data-testid="input-step-number"
              />
            </div>
            <div>
              <Label htmlFor="step-title">Titre de l'étape</Label>
              <Input
                id="step-title"
                value={stepForm.title}
                onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                placeholder="ex. Analyse de l'état"
                className="mt-2"
                data-testid="input-step-title"
              />
            </div>
            <div>
              <Label htmlFor="step-description">Description</Label>
              <Textarea
                id="step-description"
                value={stepForm.description}
                onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                placeholder="Décrivez l'étape..."
                className="mt-2"
                rows={3}
                data-testid="textarea-step-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsStepDialogOpen(false);
              setEditingStepId(null);
              setStepForm({ title: "", description: "", stepNumber: 1 });
            }} data-testid="button-cancel-step">Annuler</Button>
            {editingStepId && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Êtes-vous sûr de vouloir supprimer cette étape?")) {
                    deleteStepMutation.mutate(editingStepId);
                    setIsStepDialogOpen(false);
                    setEditingStepId(null);
                  }
                }}
                disabled={deleteStepMutation.isPending}
                data-testid="button-delete-step-dialog"
              >
                Supprimer
              </Button>
            )}
            <Button
              onClick={() => createStepMutation.mutate({ ...stepForm, workflowId: selectedWorkflowId })}
              disabled={createStepMutation.isPending || !stepForm.title}
              data-testid="button-save-step"
            >
              {createStepMutation.isPending ? "Enregistrement..." : editingStepId ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
