import { Home, FileText, DollarSign, Calendar, Settings, Package, Users, Briefcase, Wrench, ClipboardList } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import logoMyJantes from "@assets/logo-myjantes-n2iUZrkN_1759796960103.png";

const menuItems = [
  {
    title: "Tableau de bord",
    url: "/admin",
    icon: Home,
  },
  {
    title: "Prestations",
    url: "/admin/engagements",
    icon: Briefcase,
  },
  {
    title: "Atelier",
    url: "/admin/workshop",
    icon: Wrench,
  },
  {
    title: "Catalogue Services",
    url: "/admin/services-catalog",
    icon: ClipboardList,
  },
  {
    title: "Services",
    url: "/admin/services",
    icon: Package,
  },
  {
    title: "Devis",
    url: "/admin/quotes",
    icon: FileText,
  },
  {
    title: "Factures",
    url: "/admin/invoices",
    icon: DollarSign,
  },
  {
    title: "Réservations",
    url: "/admin/reservations",
    icon: Calendar,
  },
  {
    title: "Utilisateurs",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Paramètres",
    url: "/admin/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 py-6">
            <div className="bg-white rounded-lg p-3 border border-border inline-block">
              <img 
                src={logoMyJantes} 
                alt="MyJantes Logo" 
                className="h-12 w-auto"
                data-testid="logo-myjantes"
              />
            </div>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
