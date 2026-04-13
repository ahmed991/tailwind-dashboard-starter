/**
 * FarmContext — manages farm list and selected farm state.
 * Farms are loaded from PostGIS backend on login.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { farmsApi } from "../api/client";
import { useAuth } from "./AuthContext";

const FarmContext = createContext(null);

export function FarmProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadFarms = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await farmsApi.list();
      setFarms(res.data);
      if (res.data.length > 0 && !selectedFarm) {
        setSelectedFarm(res.data[0]);
      }
    } catch (e) {
      console.error("Failed to load farms:", e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]); // eslint-disable-line

  useEffect(() => {
    loadFarms();
  }, [isAuthenticated]); // eslint-disable-line

  const addFarm = useCallback(async (name, geojson, meta = {}) => {
    const res = await farmsApi.create({ name, geojson, ...meta });
    setFarms((prev) => [...prev, res.data]);
    setSelectedFarm(res.data);
    return res.data;
  }, []);

  const removeFarm = useCallback(async (id) => {
    await farmsApi.delete(id);
    setFarms((prev) => prev.filter((f) => f.id !== id));
    setSelectedFarm((prev) => (prev?.id === id ? null : prev));
  }, []);

  const getFarmGeoJSON = useCallback(async (id) => {
    const res = await farmsApi.geojson(id);
    return res.data;
  }, []);

  return (
    <FarmContext.Provider value={{ farms, selectedFarm, setSelectedFarm, loading, loadFarms, addFarm, removeFarm, getFarmGeoJSON }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarms() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarms must be used inside FarmProvider");
  return ctx;
}
