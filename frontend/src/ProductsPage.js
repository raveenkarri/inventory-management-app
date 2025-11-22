import React, { useEffect, useRef, useState } from 'react';
import api, { API_BASE } from './api';

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    unit: '',
    category: '',
    brand: '',
    stock: 0,
    status: '',
    image: ''
  });
  const [historyProduct, setHistoryProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [importResult, setImportResult] = useState(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products', {
        params: {
          search,
          category: categoryFilter,
          sort: sortField,
          order: sortOrder
        }
      });
      setProducts(res.data.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, categoryFilter, sortField, sortOrder]);

  const openNewProduct = () => {
    setEditingProduct(null);
    setFormData({
      id: null,
      name: '',
      unit: '',
      category: '',
      brand: '',
      stock: 0,
      status: '',
      image: ''
    });
    setShowForm(true);
  };

  const openEditProduct = product => {
    setEditingProduct(product);
    setFormData({
      id: product.id,
      name: product.name || '',
      unit: product.unit || '',
      category: product.category || '',
      brand: product.brand || '',
      stock: product.stock || 0,
      status: product.status || '',
      image: product.image || ''
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleFormChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'stock' ? Number(value) : value
    }));
  };

  const handleFormSubmit = async e => {
    e.preventDefault();
    try {
      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct.id}`, {
          ...formData,
          userInfo: 'admin'
        });
        const updated = res.data.product;
        setProducts(prev =>
          prev.map(p => (p.id === updated.id ? updated : p))
        );
      } else {
        const res = await api.post('/products', formData);
        const created = res.data.product;
        setProducts(prev => [created, ...prev]);
      }
      closeForm();
    } catch (e) {
      console.error(e);
      alert('Failed to save product');
    }
  };

  const handleDelete = async product => {
    if (!window.confirm(`Delete product "${product.name}"?`)) return;
    try{
      await api.delete(`/products/${product.id}`);
      setProducts(prev => prev.filter(p => p.id !== product.id));
    } catch (e) {
      console.error(e);
      alert('Failed to delete');
    }
  };

  const handleSort = field => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const openHistory = async product => {
    setHistoryProduct(product);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/products/${product.id}/history`);
      setHistory(res.data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryProduct(null);
    setHistory([]);
  };

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/products/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data);
      loadProducts();
    } catch (err) {
      console.error(err);
      alert('Import failed');
    }
  };

  const handleExport = () => {
    window.open(`${API_BASE}/products/export`, '_blank');
  };

  const getStatusLabel = stock => {
    if (stock === 0) return { label: 'Out of Stock', className: 'status-badge status-out' };
    return { label: 'In Stock', className: 'status-badge status-in' };
  };

  return (
    <div className="page-container">
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            className="search-input"
            placeholder="Search by product name"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="select-input"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button className="primary-btn" onClick={openNewProduct}>
            Add New Product
          </button>
        </div>
        <div className="toolbar-right">
          <button className="secondary-btn" onClick={triggerImport}>
            Import CSV
          </button>
          <button className="secondary-btn" onClick={handleExport}>
            Export CSV
          </button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {importResult && (
        <div className="import-result">
          <span>Imported: {importResult.added} added, {importResult.skipped} skipped</span>
          <button className="link-btn" onClick={() => setImportResult(null)}>
            Clear
          </button>
        </div>
      )}

      <div className="content-layout">
        <div className="table-card">
          {loading ? (
            <div className="loading-state">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="empty-state">No products found</div>
          ) : (
            <div className="table-wrapper">
              <table className="products-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')} className="sortable">
                      Name {sortField === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th>Unit</th>
                    <th onClick={() => handleSort('category')} className="sortable">
                      Category {sortField === 'category' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('brand')} className="sortable">
                      Brand {sortField === 'brand' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('stock')} className="sortable">
                      Stock {sortField === 'stock' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const status = getStatusLabel(p.stock || 0);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="cell-main">
                            <div className="cell-title">{p.name}</div>
                            {p.image && (
                              <div className="cell-subtitle">{p.image}</div>
                            )}
                          </div>
                        </td>
                        <td>{p.unit || '-'}</td>
                        <td>{p.category || '-'}</td>
                        <td>{p.brand || '-'}</td>
                        <td>{p.stock}</td>
                        <td>
                          <span className={status.className}>{status.label}</span>
                        </td>
                        <td>
                          <div className="actions">
                            <button className="link-btn" onClick={() => openEditProduct(p)}>
                              Edit
                            </button>
                            <button className="link-btn link-danger" onClick={() => handleDelete(p)}>
                              Delete
                            </button>
                            <button className="link-btn" onClick={() => openHistory(p)}>
                              History
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {historyProduct && (
          <div className="history-sidebar">
            <div className="history-header">
              <div className="history-title">History: {historyProduct.name}</div>
              <button className="link-btn" onClick={closeHistory}>
                Close
              </button>
            </div>
            <div className="history-body">
              {historyLoading ? (
                <div className="loading-state">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="empty-state">No history yet</div>
              ) : (
                <ul className="history-list">
                  {history.map(item => (
                    <li key={item.id} className="history-item">
                      <div className="history-quantities">
                        <span className="history-label">Old:</span> {item.old_quantity}{' '}
                        <span className="history-label">New:</span> {item.new_quantity}
                      </div>
                      <div className="history-meta">
                        <span>{new Date(item.change_date).toLocaleString()}</span>
                        {item.user_info && <span className="history-user">{item.user_info}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button className="link-btn" onClick={closeForm}>
                Close
              </button>
            </div>
            <form className="modal-body" onSubmit={handleFormSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Name</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Unit</label>
                  <input
                    name="unit"
                    value={formData.unit}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <input
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-field">
                  <label>Brand</label>
                  <input
                    name="brand"
                    value={formData.brand}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-field">
                  <label>Stock</label>
                  <input
                    type="number"
                    name="stock"
                    min="0"
                    value={formData.stock}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Status</label>
                  <input
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-field">
                  <label>Image URL</label>
                  <input
                    name="image"
                    value={formData.image}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductsPage;
