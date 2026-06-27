const fs = require('fs');
let code = fs.readFileSync('client/src/shared/layouts/AppLayout.tsx', 'utf8');

const replacement = `import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/shared/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn, formatUserRole } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";

import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import api from "@/shared/api/axiosInstance";
import { PageTransition } from "@/shared/components/PageTransition";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";`;

code = code.replace(/import \{\r?\n  NavigationMenu,[\s\S]*?from "@\/shared\/ui\/sheet";/, replacement);

fs.writeFileSync('client/src/shared/layouts/AppLayout.tsx', code);
console.log('Fixed imports successfully.');
