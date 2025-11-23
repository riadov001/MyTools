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
import { Plus, Trash2 } from "lucide-react";
import type { Service, Workflow, WorkflowStep } from "@shared/schema";

export default function AdminServiceWorkflows() {
  const { toast } = useToast();
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
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
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/workflows", data),
    onSuccess: () => {
      toast({ title: "Workflow créé", description: "Le workflow a été créé avec succès" });
      setIsWorkflowDialogOpen(false);
      setWorkflowForm({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflows"] });
    },
    onError: (error: Error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
  });

  const createStepMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/workflow-steps", data),
    onSuccess: () => {
      toast({ title: "Étape créée", description: "L'étape a été créée avec succès" });
      setIsStepDialogOpen(false);
      setStepForm({ title: "", description: "", stepNumber: 1 });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflows", selectedWorkflowId, "steps"] });
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
                    <div key={wf.id} className="p-3 border rounded-md hover-elevate cursor-pointer" 
                      onClick={() => setSelectedWorkflowId(wf.id)}>
                      <p className="font-medium">{wf.name}</p>
                      <p className="text-xs text-muted-foreground">{wf.description}</p>
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
                    {workflowSteps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 border rounded-md">
                        <Badge>{step.stepNumber}</Badge>
                        <div className="flex-1">
                          <p className="font-medium">{step.title}</p>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
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
            <Button variant="outline" onClick={() => setIsWorkflowDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createWorkflowMutation.mutate(workflowForm)}
              disabled={createWorkflowMutation.isPending || !workflowForm.name}
            >
              {createWorkflowMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une Étape</DialogTitle>
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
            <Button variant="outline" onClick={() => setIsStepDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createStepMutation.mutate({ ...stepForm, workflowId: selectedWorkflowId })}
              disabled={createStepMutation.isPending || !stepForm.title}
            >
              {createStepMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
