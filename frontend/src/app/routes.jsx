// frontend/src/app/routes.jsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import RouteFallback from "../components/RouteFallback.jsx";
import RequireAuth from "./RequireAuth.jsx";

const Landing = React.lazy(() => import("../pages/Landing.jsx"));
const Login = React.lazy(() => import("../pages/Login.jsx"));
const Register = React.lazy(() => import("../pages/Register.jsx"));

const CommentCaMarche = React.lazy(() => import("../pages/public/CommentCaMarche.jsx"));
const Metiers = React.lazy(() => import("../pages/public/Metiers.jsx"));
const PourRestaurantCuisine = React.lazy(() => import("../pages/public/PourRestaurantCuisine.jsx"));
const PourBar = React.lazy(() => import("../pages/public/PourBar.jsx"));
const PourBoulangeriePatisserie = React.lazy(() => import("../pages/public/PourBoulangeriePatisserie.jsx"));
const PourEpicerie = React.lazy(() => import("../pages/public/PourEpicerie.jsx"));
const PourPharmacie = React.lazy(() => import("../pages/public/PourPharmacie.jsx"));
const PourBoutique = React.lazy(() => import("../pages/public/PourBoutique.jsx"));
const Fonctionnalites = React.lazy(() => import("../pages/public/Fonctionnalites.jsx"));
const Tarifs = React.lazy(() => import("../pages/public/Tarifs.jsx"));
const PublicSupport = React.lazy(() => import("../pages/public/PublicSupport.jsx"));

const Dashboard = React.lazy(() => import("../pages/Dashboard.jsx"));
const Inventory = React.lazy(() => import("../pages/Inventory.jsx"));
const Products = React.lazy(() => import("../pages/Products.jsx"));
const Categories = React.lazy(() => import("../pages/Categories.jsx"));
const Exports = React.lazy(() => import("../pages/Exports.jsx"));
const Losses = React.lazy(() => import("../pages/Losses.jsx"));
const Settings = React.lazy(() => import("../pages/Settings.jsx"));
const Support = React.lazy(() => import("../pages/Support.jsx"));

const Terms = React.lazy(() => import("../pages/Terms.jsx"));
const Privacy = React.lazy(() => import("../pages/Privacy.jsx"));
const Legal = React.lazy(() => import("../pages/Legal.jsx"));
const NotFound = React.lazy(() => import("../pages/NotFound.jsx"));

const InvitationAccept = React.lazy(() => import("../pages/InvitationAccept.jsx"));

const ForgotPassword = React.lazy(() => import("../pages/ForgotPassword.jsx"));
const CheckEmail = React.lazy(() => import("../pages/CheckEmail.jsx"));
const VerifyEmail = React.lazy(() => import("../pages/VerifyEmail.jsx"));
const ResetPassword = React.lazy(() => import("../pages/ResetPassword.jsx"));
const ConfirmEmail = React.lazy(() => import("../pages/ConfirmEmail.jsx"));
const BillingSuccess = React.lazy(() => import("../pages/billing/Success.jsx"));
const BillingCancel = React.lazy(() => import("../pages/billing/Cancel.jsx"));

const Protected = ({ children }) => <RequireAuth>{children}</RequireAuth>;

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/invitation/accept" element={<InvitationAccept />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/check-email" element={<CheckEmail />} />

        {/* Security callbacks */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/confirm-email" element={<ConfirmEmail />} />

        <Route path="/comment-ca-marche" element={<CommentCaMarche />} />
        <Route path="/metiers" element={<Metiers />} />
        <Route path="/pour-restaurant-cuisine" element={<PourRestaurantCuisine />} />
        <Route path="/pour-bar" element={<PourBar />} />
        <Route path="/pour-boulangerie-patisserie" element={<PourBoulangeriePatisserie />} />
        <Route path="/pour-epicerie" element={<PourEpicerie />} />
        <Route path="/pour-pharmacie" element={<PourPharmacie />} />
        <Route path="/pour-boutique" element={<PourBoutique />} />
        <Route path="/fonctionnalites" element={<Fonctionnalites />} />
        <Route path="/tarifs" element={<Tarifs />} />
        <Route path="/support" element={<PublicSupport />} />
        <Route path="/billing/success" element={<BillingSuccess />} />
        <Route path="/billing/cancel" element={<BillingCancel />} />

        {/* SEO aliases */}
        <Route path="/cgu" element={<Navigate to="/terms" replace />} />
        <Route path="/confidentialite" element={<Navigate to="/privacy" replace />} />
        <Route path="/mentions-legales" element={<Navigate to="/legal" replace />} />

        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/legal" element={<Legal />} />

        {/* App (protected) */}
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route
          path="/app/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/app/inventory"
          element={
            <Protected>
              <Inventory />
            </Protected>
          }
        />
        <Route
          path="/app/products"
          element={
            <Protected>
              <Products />
            </Protected>
          }
        />
        <Route
          path="/app/categories"
          element={
            <Protected>
              <Categories />
            </Protected>
          }
        />
        <Route
          path="/app/exports"
          element={
            <Protected>
              <Exports />
            </Protected>
          }
        />
        <Route
          path="/app/losses"
          element={
            <Protected>
              <Losses />
            </Protected>
          }
        />
        <Route
          path="/app/settings"
          element={
            <Protected>
              <Settings />
            </Protected>
          }
        />
        <Route
          path="/app/support"
          element={
            <Protected>
              <Support />
            </Protected>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
