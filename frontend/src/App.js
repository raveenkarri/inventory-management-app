import React from 'react';
import ProductsPage from './ProductsPage';
import './App.css';

function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-logo">Inventory Manager</div>
        <div className="app-header-right">
          <span className="app-badge">Skillwise Assignment</span>
        </div>
      </header>
      <main className="app-main">
        <ProductsPage />
      </main>
    </div>
  );
}

export default App;
