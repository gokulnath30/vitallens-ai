// VitalLens AI — config
// SECURITY: never commit/deploy a real token here. The token is entered at runtime
// via ⚙️ Settings and kept only in the browser's localStorage.
window.VITALLENS_CONFIG = {
  apiKey: "",                                              // leave empty — set it in Settings
  baseUrl: "https://api.tokenfactory.nebius.com/v1",
  model: "Qwen/Qwen2.5-VL-72B-Instruct",                   // vision: reads report & food images
  textModel: "Qwen/Qwen3-235B-A22B-Instruct-2507"          // reasoning: writes the health plan
};
