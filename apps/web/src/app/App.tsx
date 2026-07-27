import { Route, Routes } from "react-router";

import { ApplicationRuntimeHost } from "./ApplicationRuntimeHost";
import { CountryCatalogPage } from "../features/countryCatalog/CountryCatalogPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<CountryCatalogPage />} />
      <Route path="*" element={<ApplicationRuntimeHost />} />
    </Routes>
  );
}
