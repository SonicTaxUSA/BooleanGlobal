import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";

import About from "./pages/About";
import Book from "./pages/Book";
import Business from "./pages/Business";
import Console from "./pages/Console";
import Contact from "./pages/Contact";
import HealthInsurance from "./pages/HealthInsurance";
import Index from "./pages/Index";
import Medicare from "./pages/Medicare";
import MyVictora from "./pages/MyVictora";
import NotFound from "./pages/NotFound";
import Quote from "./pages/Quote";
import Resources from "./pages/Resources";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster position="top-center" />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/health-insurance" element={<HealthInsurance />} />
            <Route path="/medicare" element={<Medicare />} />
            <Route path="/business" element={<Business />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/quote" element={<Quote />} />
            <Route path="/book" element={<Book />} />
            <Route path="/client" element={<MyVictora />} />
            <Route path="/admin" element={<Console />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
