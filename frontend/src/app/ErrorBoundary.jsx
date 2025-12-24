// frontend/src/app/ErrorBoundary.jsx
import React from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true, errorId: `err_${Date.now()}` };
  }

  componentDidCatch(error, info) {
    // Log dev (tu pourras brancher Sentry plus tard)
    // eslint-disable-next-line no-console
    console.error("UI crash:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[70vh] grid place-items-center px-4">
        <Card className="w-full max-w-lg glass border-white/10 bg-white/5 text-white">
          <div className="p-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/60">Oups</div>
              <h1 className="text-2xl font-black leading-tight">Un souci d’affichage est survenu</h1>
              <p className="text-white/70 mt-2">
                Rien n’est perdu. Essaie de recharger la page.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="justify-center" onClick={this.handleReload}>
                Recharger
              </Button>
              <Button variant="secondary" className="justify-center" onClick={this.handleGoHome}>
                Retour à l’accueil
              </Button>
            </div>

            <div className="text-xs text-white/40">
              Réf: {this.state.errorId}
            </div>
          </div>
        </Card>
      </div>
    );
  }
}