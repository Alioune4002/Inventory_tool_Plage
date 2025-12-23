import React from "react";
import { Routes, Route } from "react-router-dom";

import Landing from "../pages/Landing.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import CommentCaMarche from "../pages/public/CommentCaMarche.jsx";
import Metiers from "../pages/public/Metiers.jsx";
import PourRestaurantCuisine from "../pages/public/PourRestaurantCuisine.jsx";
import PourBar from "../pages/public/PourBar.jsx";
import PourBoulangeriePatisserie from "../pages/public/PourBoulangeriePatisserie.jsx";
import PourEpicerie from "../pages/public/PourEpicerie.jsx";
import PourPharmacie from "../pages/public/PourPharmacie.jsx";
import PourBoutique from "../pages/public/PourBoutique.jsx";
import Fonctionnalites from "../pages/public/Fonctionnalites.jsx";
import Tarifs from "../pages/public/Tarifs.jsx";
import PublicSupport from "../pages/public/PublicSupport.jsx";

import Dashboard from "../pages/Dashboard.jsx";
import Inventory from "../pages/Inventory.jsx";
import Products from "../pages/Products.jsx";
import Categories from "../pages/Categories.jsx";
import Exports from "../pages/Exports.jsx";
import Losses from "../pages/Losses.jsx";
import Settings from "../pages/Settings.jsx";
import Support from "../pages/Support.jsx";

import Terms from "../pages/Terms.jsx";
import Privacy from "../pages/Privacy.jsx";
import Legal from "../pages/Legal.jsx";
import NotFound from "../pages/NotFound.jsx";

import InvitationAccept from "../pages/InvitationAccept.jsx";
import RequireAuth from "./RequireAuth.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/invitation/accept" element={<InvitationAccept />} />

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

      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/cgu" element={<Terms />} />
      <Route path="/confidentialite" element={<Privacy />} />

      {/* Mentions légales */}
      <Route path="/legal" element={<Legal />} />
      <Route path="/mentions-legales" element={<Legal />} />

      {/* App (protected) */}
      <Route
        path="/app/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/app/inventory"
        element={
          <RequireAuth>
            <Inventory />
          </RequireAuth>
        }
      />
      <Route
        path="/app/products"
        element={
          <RequireAuth>
            <Products />
          </RequireAuth>
        }
      />
      <Route
        path="/app/categories"
        element={
          <RequireAuth>
            <Categories />
          </RequireAuth>
        }
      />
      <Route
        path="/app/exports"
        element={
          <RequireAuth>
            <Exports />
          </RequireAuth>
        }
      />
      <Route
        path="/app/losses"
        element={
          <RequireAuth>
            <Losses />
          </RequireAuth>
        }
      />
      <Route
        path="/app/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />
      <Route
        path="/app/support"
        element={
          <RequireAuth>
            <Support />
          </RequireAuth>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}