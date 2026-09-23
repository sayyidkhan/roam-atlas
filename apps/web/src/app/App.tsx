import { Navigate, Route, Routes } from "react-router";

import { ApplicationRuntimeHost } from "./ApplicationRuntimeHost";
import { CountryCatalogPage } from "../features/countryCatalog/CountryCatalogPage";
import { UsagePage } from "../features/usage/UsagePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<CountryCatalogPage />} />
      <Route path="/usage" element={<UsagePage />} />
      <Route
        path="/:countrySlug/config"
        element={<ApplicationRuntimeHost />}
      />
      <Route
        path="/:countrySlug/place/:nodeId"
        element={<ApplicationRuntimeHost />}
      />
      <Route
        path="/:countrySlug"
        element={<ApplicationRuntimeHost />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
