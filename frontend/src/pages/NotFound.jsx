import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Page introuvable</h1>
      <p className="text-slate-600 text-sm">La page que vous cherchez n’existe pas.</p>
      <Link to="/" className="btn btn-primary">
        Retour à l’accueil
      </Link>
    </div>
  );
}

export default NotFound;
