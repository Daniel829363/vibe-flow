import { useState, useEffect } from "react";
import axios from "axios";

let globalTokenRate = 100;
let rateFetched = false;

const fetchRateOnce = async () => {
  if (rateFetched) return globalTokenRate;
  try {
    const res = await axios.get("/api/tokens/rate");
    if (res.data?.rate) {
      globalTokenRate = Number(res.data.rate);
      rateFetched = true;
    }
  } catch {
    // fallback 100
  }
  return globalTokenRate;
};

export const useGenerationCost = (selectedModel, formValues) => {
  const [generationCost, setGenerationCost] = useState(null);
  const [generationCostTokens, setGenerationCostTokens] = useState(null);
  const [tokenRate, setTokenRate] = useState(globalTokenRate);
  const [isRefreshingCost, setIsRefreshingCost] = useState(false);

  useEffect(() => {
    fetchRateOnce().then((r) => setTokenRate(r));
  }, []);

  useEffect(() => {
    if (!selectedModel?.id || selectedModel.id.includes("passthrough")) {
      setGenerationCost(null);
      setGenerationCostTokens(null);
      return;
    }

    const delayDebounce = setTimeout(() => {
      setIsRefreshingCost(true);
      axios.post("/api/app/calculate_dynamic_cost", {
        task_name: selectedModel.id,
        payload: formValues
      })
      .then((response) => {
        const cost = response.data?.cost ?? null;
        setGenerationCost(cost);
        if (cost !== null && cost !== undefined) {
          const tokens = Math.round(Number(cost) * tokenRate * 100) / 100;
          setGenerationCostTokens(tokens);
        } else {
          setGenerationCostTokens(null);
        }
        setIsRefreshingCost(false);
      })
      .catch((error) => {
        console.error("Error fetching cost:", error);
        setGenerationCost(null);
        setGenerationCostTokens(null);
        setIsRefreshingCost(false);
      });
    }, 1000);

    return () => clearTimeout(delayDebounce);
  }, [selectedModel?.id, formValues, tokenRate]);

  return { generationCost, generationCostTokens, tokenRate, isRefreshingCost };
};
