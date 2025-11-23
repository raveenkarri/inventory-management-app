import axios from 'axios';

export const API_BASE = "https://inventory-management-app-wt4d.onrender.com" || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE
});

export default api;
