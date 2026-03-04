import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ModelLibrary from "./pages/ModelLibrary";
import { ModelWorkspaceLayout } from "./components/ModelWorkspaceLayout";
import ModelOverview from "./pages/ModelOverview";
import GeneralData from "./pages/GeneralData";
import LaborData from "./pages/LaborData";
import EquipmentData from "./pages/EquipmentData";
import ProductData from "./pages/ProductData";
import OperationsRouting from "./pages/OperationsRouting";
import IBOMScreen from "./pages/IBOMScreen";
import RunResults from "./pages/RunResults";
import WhatIfStudio from "./pages/WhatIfStudio";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<ModelLibrary />} />
          <Route path="/models/:modelId" element={<ModelWorkspaceLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<ModelOverview />} />
            <Route path="general" element={<GeneralData />} />
            <Route path="labor" element={<LaborData />} />
            <Route path="equipment" element={<EquipmentData />} />
            <Route path="products" element={<ProductData />} />
            <Route path="operations" element={<OperationsRouting />} />
            <Route path="ibom" element={<IBOMScreen />} />
            <Route path="run" element={<RunResults />} />
            <Route path="whatif" element={<PlaceholderPage />} />
            <Route path="reports" element={<PlaceholderPage />} />
            <Route path="settings" element={<PlaceholderPage />} />
          </Route>
          <Route path="/settings" element={<PlaceholderPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
