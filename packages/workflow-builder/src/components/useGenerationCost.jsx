import { useState, useEffect, useRef } from "react";
import axios from "axios";

let globalTokenRate = 100;
let rateFetched = false;
const costCache = new Map();

export const fetchRateOnce = async () => {
  if (rateFetched) return globalTokenRate;
  try {
    const res = await axios.get("/api/tokens/rate");
    if (res.data?.base_rate || res.data?.rate) {
      globalTokenRate = Number(res.data.base_rate || res.data.rate);
      rateFetched = true;
    }
  } catch {
    // fallback 100
  }
  return globalTokenRate;
};

export const cleanPayloadForCost = (payload) => {
  if (!payload || typeof payload !== "object") return {};
  const cleaned = {};
  const IGNORED_KEYS = new Set(["make_output", "make_input"]);

  for (const [key, value] of Object.entries(payload)) {
    if (IGNORED_KEYS.has(key)) continue;
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

export const extractDefaultFormValues = (schemaProperties) => {
  const initialData = {};
  const fieldEntries = Object.entries(schemaProperties || {});

  fieldEntries.forEach(([fieldName, fieldSchema]) => {
    if (!fieldSchema) return;
    if (fieldSchema.type === "array") {
      if (fieldSchema.items?.type === "object") {
        const examples = fieldSchema.examples;
        if (Array.isArray(examples) && examples.length > 0) {
          initialData[fieldName] = examples.map((ex) => ({ ...ex }));
        } else {
          initialData[fieldName] = [];
        }
      } else if (Array.isArray(fieldSchema.examples) && fieldSchema.examples.length > 0) {
        initialData[fieldName] = fieldSchema.examples;
      } else if (Array.isArray(fieldSchema.default)) {
        initialData[fieldName] = [...fieldSchema.default];
      } else {
        initialData[fieldName] = [];
      }
    } else if (fieldSchema.type === "object") {
      const nestedProps = fieldSchema.properties || {};
      initialData[fieldName] = extractDefaultFormValues(nestedProps);
    } else if (fieldSchema.default !== undefined && fieldSchema.default !== null) {
      initialData[fieldName] = fieldSchema.default;
    } else if (Array.isArray(fieldSchema.examples) && fieldSchema.examples.length > 0) {
      initialData[fieldName] = fieldSchema.examples[0];
    } else if (Array.isArray(fieldSchema.enum) && fieldSchema.enum.length > 0) {
      initialData[fieldName] = fieldSchema.enum[0];
    } else {
      switch (fieldSchema.type) {
        case "boolean":
          initialData[fieldName] = false;
          break;
        case "int":
        case "integer":
        case "number":
          initialData[fieldName] = fieldSchema.minimum ?? 0;
          break;
        default:
          initialData[fieldName] = "";
      }
    }
  });

  return initialData;
};

export const getModelDefaultFormValues = (model, nodeSchemas) => {
  if (!model?.id) return {};
  let properties = model?.input_schema?.schemas?.input_data?.properties 
    || model?.input_schema?.properties 
    || model?.input_params?.properties;

  if (!properties && nodeSchemas?.categories) {
    for (const cat of Object.values(nodeSchemas.categories)) {
      if (cat?.models?.[model.id]) {
        properties = cat.models[model.id]?.input_schema?.schemas?.input_data?.properties
          || cat.models[model.id]?.input_schema?.properties;
        break;
      }
    }
  }

  return extractDefaultFormValues(properties || {});
};

export const API_NODE_MODEL_IDS = new Set(["wavespeed", "straico", "runware", "genvr"]);

export const calculateDynamicCost = async (taskName, payload) => {
  if (!taskName || taskName.includes("passthrough")) {
    return { cost: 0.0 };
  }

  if (API_NODE_MODEL_IDS.has(taskName)) {
    return { cost: 0.025 };
  }

  const cleaned = cleanPayloadForCost(payload);
  const cacheKey = `${taskName}::${JSON.stringify(cleaned)}`;

  if (costCache.has(cacheKey)) {
    return { cost: costCache.get(cacheKey) };
  }

  try {
    const response = await axios.post("/api/app/calculate_dynamic_cost", {
      task_name: taskName,
      payload: cleaned,
    });
    const cost = response.data?.cost !== undefined && response.data?.cost !== null
      ? Number(response.data.cost)
      : 0.0;

    costCache.set(cacheKey, cost);
    return { cost };
  } catch (error) {
    console.error(`Error calculating dynamic cost for ${taskName}:`, error);
    return { cost: null, error };
  }
};

export const useGenerationCost = (selectedModel, formValues) => {
  const [generationCost, setGenerationCost] = useState(null);
  const [generationCostTokens, setGenerationCostTokens] = useState(null);
  const [tokenRate, setTokenRate] = useState(globalTokenRate);
  const [isRefreshingCost, setIsRefreshingCost] = useState(false);
  const lastRequestedKeyRef = useRef("");

  useEffect(() => {
    fetchRateOnce().then((r) => setTokenRate(r));
  }, []);

  const modelId = selectedModel?.id;
  const serializedValues = JSON.stringify(cleanPayloadForCost(formValues));

  useEffect(() => {
    if (!modelId || modelId.includes("passthrough")) {
      setGenerationCost(null);
      setGenerationCostTokens(null);
      setIsRefreshingCost(false);
      lastRequestedKeyRef.current = "";
      return;
    }

    if (API_NODE_MODEL_IDS.has(modelId)) {
      const fixedCost = 0.025;
      setGenerationCost(fixedCost);
      const tokens = Math.round(Number(fixedCost) * tokenRate * 100) / 100;
      setGenerationCostTokens(tokens);
      setIsRefreshingCost(false);
      lastRequestedKeyRef.current = `${modelId}::${serializedValues}`;
      return;
    }

    const currentKey = `${modelId}::${serializedValues}`;

    // Instant cache check
    if (costCache.has(currentKey)) {
      const cachedCost = costCache.get(currentKey);
      setGenerationCost(cachedCost);
      if (cachedCost !== null && cachedCost !== undefined) {
        const tokens = Math.round(Number(cachedCost) * tokenRate * 100) / 100;
        setGenerationCostTokens(tokens);
      } else {
        setGenerationCostTokens(null);
      }
      setIsRefreshingCost(false);
      lastRequestedKeyRef.current = currentKey;
      return;
    }

    setIsRefreshingCost(true);
    const delayDebounce = setTimeout(() => {
      calculateDynamicCost(modelId, formValues)
        .then(({ cost }) => {
          if (lastRequestedKeyRef.current !== currentKey && cost === null) {
            // Outdated request returned, ignore
            return;
          }
          setGenerationCost(cost);
          if (cost !== null && cost !== undefined) {
            const tokens = Math.round(Number(cost) * tokenRate * 100) / 100;
            setGenerationCostTokens(tokens);
          } else {
            setGenerationCostTokens(null);
          }
          setIsRefreshingCost(false);
          lastRequestedKeyRef.current = currentKey;
        })
        .catch(() => {
          setIsRefreshingCost(false);
        });
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [modelId, serializedValues, tokenRate]);

  return { generationCost, generationCostTokens, tokenRate, isRefreshingCost };
};
