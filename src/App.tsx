import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ModelLibrary from "./pages/ModelLibrary";
import { ModelWorkspaceLayout } from "./components/ModelWorkspaceLayout";
import ModelOverview from "./pages/ModelOverview";
import GeneralData from "./pages/GeneralData";
import LaborData from "./pages/LaborData";
import EquipmentData from "./pages/EquipmentData";
import ProductData from "./pages/ProductData";
import OperationsRouting from "./pages/OperationsRouting";
import TroobaIntelligence from "./pages/TroobaIntelligence";
import IBOMScreen from "./pages/IBOMScreen";

import RunResults from "./pages/RunResults";
import WhatIfStudio from "./pages/WhatIfStudio";
import Reports from "./pages/Reports";
import PlaceholderPage from "./pages/PlaceholderPage";
import SettingsPage from "./pages/SettingsPage";
import ModelSettings from "./pages/ModelSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Navigate to="/library" replace /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><ModelLibrary /></ProtectedRoute>} />
            <Route path="/models/:modelId" element={<ProtectedRoute><ModelWorkspaceLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<ModelOverview />} />
              <Route path="general" element={<GeneralData />} />
              <Route path="labor" element={<LaborData />} />
              <Route path="equipment" element={<EquipmentData />} />
              <Route path="products" element={<ProductData />} />
              <Route path="operations" element={<OperationsRouting />} />
              <Route path="intelligence" element={<TroobaIntelligence />} />
              <Route path="all-operations" element={<TroobaIntelligence />} />
              <Route path="ibom" element={<IBOMScreen />} />
              <Route path="param-names" element={<Navigate to="../settings?tab=params" replace />} />
              <Route path="run" element={<RunResults />} />
              <Route path="whatif" element={<WhatIfStudio />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<ModelSettings />} />
            </Route>
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
