/* ==========================================================================
   ASISTENTE DE INTELIGENCIA ARTIFICIAL - LOGICA DE CONEXION (asistente.js)
   ========================================================================== */

// Configuración y variables de estado del asistente
const state = {
  students: [],
  apiKey: "",
  apiProvider: "gemini",
  messages: [],
  isGenerating: false
};

// Nombres de Carreras Mapeadas (Copiar para concordancia de nombres)
const CAREER_NAMES = {
  "010306": "Arquitectura. Presencial.",
  "010315": "Ingeniería en Control Eléctrico. Presencial.",
  "010318": "Ingeniería en Ciencias de la computación. No presencial.",
  "010321": "Ingeniería en Diseños y Desarrollo de Videojuegos. Presencial.",
  "010325": "Ingeniería Industrial. Semipresencial.",
  "010332": "Ingeniería en Sistemas y Ciberseguridad. Semipresencial",
  "010801": "Licenciatura en Diseño de Modas. Presencial.",
  "010803": "Licenciatura en Diseño Gráfico Publicitario. Presencial.",
  "010805": "Licenciatura en Diseño Gráfico Web Multimedia. Presencial.",
  "010807": "Técnico en Decoración. Presencial.",
  "010808": "Técnico en Diseño Gráfico Publicitario. Presencial.",
  "010811": "Licenciatura en Animación Digital y Videojuegos. Presencial.",
  "010812": "Técnico en Animación Digital y Videojuegos. Presencial.",
  "010813": "Licenciatura en Diseño Gráfico Publicitario. No Presencial.",
  "010814": "Licenciatura en Diseño Gráfico Publicitario. Semipresencial."
};

// Inicialización de la vista
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar Iconos Lucide
  lucide.createIcons();

  // Asegurar que las configuraciones de periodo por defecto estén inicializadas
  getPeriodsConfig();
  getActivePeriod();

  // Control del tema claro/oscuro
  setupThemeToggle();

  // Inicializar selector global de periodos
  initGlobalPeriodSelector((newPeriod) => {
    loadAcademicData();
    refreshLayout();
    resetChatHistory(); // Limpiar chat para evitar mezclar contextos de ciclos
  });

  // Cargar datos persistidos
  loadAcademicData();
  loadAIConfig();

  // Registrar Event Listeners
  setupEventListeners();

  // Actualizar UI inicial
  refreshLayout();
});

// Cargar estudiantes de localStorage filtrados por ciclo
function loadAcademicData() {
  const saved = localStorage.getItem("atenas_students");
  if (saved) {
    const allStudents = JSON.parse(saved);
    const activePeriod = getActivePeriod();
    const periodsConfig = getPeriodsConfig();
    const periodConfig = periodsConfig[activePeriod] || DEFAULT_PERIODS_CONFIG["Ciclo 1 - 2026"];

    state.students = allStudents.filter(s => s.periodo === activePeriod);
    state.students.forEach(student => {
      calculateStudentMetrics(student, SYSTEM_CONFIG, periodConfig);
    });
  } else {
    state.students = [];
  }
}

// Cargar configuración de la API de localStorage
function loadAIConfig() {
  state.apiKey = localStorage.getItem("atenas_ai_key") || "";
  state.apiProvider = localStorage.getItem("atenas_ai_provider") || "gemini";
  
  // Rellenar selectores si existen valores anteriores
  const providerSelect = document.getElementById("provider-select");
  if (providerSelect) providerSelect.value = state.apiProvider;
}

// Guardar configuración de la API
defSaveConfig = (provider, key) => {
  state.apiProvider = provider;
  state.apiKey = key.trim();
  
  localStorage.setItem("atenas_ai_provider", state.apiProvider);
  localStorage.setItem("atenas_ai_key", state.apiKey);
  
  refreshLayout();
};

// Limpiar historial de chat en memoria y pantalla
function resetChatHistory() {
  state.messages = [];
  const container = document.getElementById("chat-messages-container");
  if (container) {
    container.innerHTML = `
      <div class="chat-bubble ai">
        <span style="font-weight: 600; color: var(--color-primary); font-size: 0.8rem; display: block; margin-bottom: 2px;">${t("chat_role_ai")}</span>
        <p id="welcome-message-text">${t("chat_welcome")}</p>
        <span class="message-meta">Sistema</span>
      </div>
    `;
  }
}

// Limpiar configuración de la API
function clearAIConfig() {
  state.apiKey = "";
  localStorage.removeItem("atenas_ai_key");
  
  const keyInput = document.getElementById("api-key-input");
  if (keyInput) keyInput.value = "";
  
  resetChatHistory();
  refreshLayout();
}

// Refrescar layouts según estado de datos y API Key
function refreshLayout() {
  const onboardingPanel = document.getElementById("ai-onboarding-panel");
  const chatPanel = document.getElementById("ai-chat-panel");
  const noDataPanel = document.getElementById("no-data-warning-panel");
  const btnSettings = document.getElementById("btn-api-settings");
  const btnClearChat = document.getElementById("btn-clear-chat");
  
  // 1. Si no hay estudiantes cargados
  if (state.students.length === 0) {
    if (onboardingPanel) onboardingPanel.style.display = "none";
    if (chatPanel) chatPanel.style.display = "none";
    if (noDataPanel) noDataPanel.style.display = "block";
    if (btnSettings) btnSettings.style.display = "none";
    if (btnClearChat) btnClearChat.style.display = "none";
    updateAPIStatusBadge(false, t("badge_no_data"));
    return;
  }
  
  noDataPanel.style.display = "none";
  
  // 2. Si no hay API key configurada
  if (!state.apiKey) {
    if (onboardingPanel) onboardingPanel.style.display = "block";
    if (chatPanel) chatPanel.style.display = "none";
    if (btnSettings) btnSettings.style.display = "none";
    if (btnClearChat) btnClearChat.style.display = "none";
    updateAPIStatusBadge(false, t("badge_not_configured"));
  } else {
    // 3. API configurada y datos listos
    if (onboardingPanel) onboardingPanel.style.display = "none";
    if (chatPanel) chatPanel.style.display = "block";
    if (btnSettings) btnSettings.style.display = "inline-flex";
    if (btnClearChat) btnClearChat.style.display = "inline-flex";
    
    const provLabel = state.apiProvider === "gemini" ? "Gemini" : (state.apiProvider === "openai" ? "ChatGPT" : "Claude");
    updateAPIStatusBadge(true, t("badge_connected", { provider: provLabel }));
    
    // Auto scroll al chat
    scrollToBottom();
  }
}

// Actualizar badge de estado del servicio API
function updateAPIStatusBadge(isConfigured, text) {
  const container = document.getElementById("api-status-badge-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  const badge = document.createElement("span");
  badge.className = `status-badge ${isConfigured ? 'configured' : 'unconfigured'}`;
  badge.innerHTML = `
    <i data-lucide="${isConfigured ? 'check-circle' : 'alert-circle'}" style="width: 12px; height: 12px;"></i>
    <span>API: ${text}</span>
  `;
  container.appendChild(badge);
  lucide.createIcons();
}

// Configurar los listeners de eventos
function setupEventListeners() {
  // Pestañas del Instructivo
  const tabs = document.querySelectorAll(".instruction-tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const tabId = tab.getAttribute("data-tab");
      const contents = document.querySelectorAll(".instruction-tab-content");
      contents.forEach(c => c.classList.remove("active"));
      
      const activeContent = document.getElementById(tabId);
      if (activeContent) activeContent.classList.add("active");
    });
  });

  // Guardar API Key
  const btnSave = document.getElementById("btn-save-key");
  if (btnSave) {
    btnSave.addEventListener("click", () => {
      const provider = document.getElementById("provider-select").value;
      const key = document.getElementById("api-key-input").value;
      
      if (!key.trim()) {
        alert(t("err_invalid_key"));
        return;
      }
      
      defSaveConfig(provider, key);
    });
  }

  // Modificar/Resetear API Key
  const btnSettings = document.getElementById("btn-api-settings");
  if (btnSettings) {
    btnSettings.addEventListener("click", () => {
      showConfirmModal(t("confirm_title_api"), t("confirm_change_api"), "warning")
        .then(confirmed => {
          if (confirmed) {
            clearAIConfig();
          }
        });
    });
  }

  // Limpiar Chat
  const btnClearChat = document.getElementById("btn-clear-chat");
  if (btnClearChat) {
    btnClearChat.addEventListener("click", () => {
      showConfirmModal(t("confirm_title_chat"), t("confirm_clear_chat"), "warning")
        .then(confirmed => {
          if (confirmed) {
            resetChatHistory();
          }
        });
    });
  }

  // Chips de preguntas sugeridas
  const chips = document.querySelectorAll(".suggestion-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const qKey = chip.getAttribute("data-question-key");
      const question = qKey ? t(qKey) : chip.getAttribute("data-question");
      const textarea = document.getElementById("chat-textarea-input");
      if (textarea) {
        textarea.value = question;
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
        textarea.focus();
      }
    });
  });

  // Botón enviar mensaje
  const btnSend = document.getElementById("btn-send-message");
  if (btnSend) {
    btnSend.addEventListener("click", handleSendMessage);
  }

  // Enviar mensaje al presionar Enter en el textarea
  const textareaInput = document.getElementById("chat-textarea-input");
  if (textareaInput) {
    textareaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Auto-escalar altura de la entrada de texto
    textareaInput.addEventListener("input", () => {
      textareaInput.style.height = "auto";
      textareaInput.style.height = textareaInput.scrollHeight + "px";
    });
  }
}

// Desplazarse al final del historial del chat
function scrollToBottom() {
  const container = document.getElementById("chat-messages-container");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// Agregar mensaje en pantalla
function appendMessage(role, text, isLoader = false) {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;
  
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  if (isLoader) {
    bubble.id = "ai-typing-indicator";
  }

  const roleLabel = role === "user" ? t("chat_role_user").toUpperCase() : t("chat_role_ai").toUpperCase();
  const color = role === "user" ? "rgba(255,255,255,0.8)" : "var(--color-primary)";
  
  let contentHTML = `<span style="font-weight: 600; color: ${color}; font-size: 0.8rem; display: block; margin-bottom: 2px;">${roleLabel}</span>`;
  
  if (isLoader) {
    contentHTML += `
      <div class="ai-typing-loader">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  } else {
    // Formateo básico de markdown para la respuesta de la IA
    const formattedText = formatMarkdown(text);
    contentHTML += `<div class="chat-bubble-text">${formattedText}</div>`;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  contentHTML += `<span class="message-meta">${timeStr}</span>`;

  bubble.innerHTML = contentHTML;
  container.appendChild(bubble);
  scrollToBottom();
}

// Convertir marcas de markdown básicas (*, -, \n) a HTML
function formatMarkdown(text) {
  if (!text) return "";
  
  // Escapar HTML básico de la entrada del usuario para evitar inyecciones XSS
  let cleanText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = cleanText.split("\n");
  let html = "";
  let listStack = []; // Almacena objetos { type: 'ul'|'ol', indent: number }

  // Cerrar listas hasta un nivel de indentación específico
  function closeListsToLevel(targetIndent) {
    while (listStack.length > 0 && listStack[listStack.length - 1].indent > targetIndent) {
      const closed = listStack.pop();
      html += `</${closed.type}>`;
    }
  }

  // Ajustar la apertura/cierre de listas según el tipo e indentación
  function adjustListNesting(type, indent) {
    closeListsToLevel(indent);

    if (listStack.length === 0) {
      listStack.push({ type, indent });
      html += `<${type}>`;
    } else {
      const currentList = listStack[listStack.length - 1];
      if (currentList.indent === indent) {
        if (currentList.type !== type) {
          html += `</${currentList.type}><${type}>`;
          currentList.type = type;
        }
      } else if (indent > currentList.indent) {
        listStack.push({ type, indent });
        html += `<${type}>`;
      }
    }
  }

  // Soportar estilos en línea (negritas, cursivas, código en línea)
  function parseInlineStyles(str) {
    let result = str;
    // Negritas: **texto**
    result = result.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Cursivas: *texto*
    result = result.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Código en línea: `code`
    result = result.replace(/`(.*?)`/g, "<code style='background: rgba(255,255,255,0.07); padding: 2px 6px; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.85rem; color: var(--color-accent);'>$1</code>");
    return result;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Línea vacía: cierra listas y salta línea
    if (trimmedLine === "") {
      closeListsToLevel(-1);
      html += "<br>";
      continue;
    }

    // Encabezados: # título, ## subtítulo
    const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      closeListsToLevel(-1);
      const level = headerMatch[1].length;
      const content = parseInlineStyles(headerMatch[2]);
      const fontSize = level === 1 ? "1.25rem" : level === 2 ? "1.15rem" : "1.05rem";
      html += `<h${level} style="font-size: ${fontSize}; font-weight: 700; margin-top: 12px; margin-bottom: 6px; color: var(--text-highlight);">${content}</h${level}>`;
      continue;
    }

    // Listas desordenadas (* o -) y ordenadas (1., 2., etc.)
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

    if (ulMatch) {
      const indent = ulMatch[1].length;
      const content = ulMatch[2];
      adjustListNesting('ul', indent);
      html += `<li>${parseInlineStyles(content)}</li>`;
    } else if (olMatch) {
      const indent = olMatch[1].length;
      const content = olMatch[3];
      adjustListNesting('ol', indent);
      html += `<li>${parseInlineStyles(content)}</li>`;
    } else {
      // Línea de párrafo regular
      closeListsToLevel(-1);
      html += `${parseInlineStyles(trimmedLine)}<br>`;
    }
  }

  // Cerrar todas las listas al terminar el documento
  closeListsToLevel(-1);

  // Limpiar saltos de línea redundantes al final
  return html.replace(/(<br>)+$/, "");
}

// Remover el indicador de "escribiendo"
function removeTypingIndicator() {
  const el = document.getElementById("ai-typing-indicator");
  if (el) el.remove();
}

// Manejar el envío de mensajes
function handleSendMessage() {
  const textarea = document.getElementById("chat-textarea-input");
  if (!textarea) return;
  
  const text = textarea.value.trim();
  if (!text || state.isGenerating) return;

  // 1. Mostrar mensaje del usuario
  appendMessage("user", text);
  
  // Limpiar y resetear textarea
  textarea.value = "";
  textarea.style.height = "48px";
  
  // Guardar en el historial local del ciclo de vida de la página
  state.messages.push({ role: "user", content: text });
  
  // 2. Bloquear controles
  state.isGenerating = true;
  toggleInputState(true);
  
  // 3. Mostrar indicador de escritura
  appendMessage("ai", "", true);

  // 4. Preparar contexto de los estudiantes en JSON estructurado y resumido
  const dataContext = buildContextSummary();

  // 5. Llamar al proveedor
  callAIProvider(text, dataContext)
    .then(response => {
      removeTypingIndicator();
      appendMessage("ai", response);
      state.messages.push({ role: "ai", content: response });
    })
    .catch(error => {
      removeTypingIndicator();
      const errorMsg = t("err_api_connection", { error: error.message });
      appendMessage("ai", errorMsg);
    })
    .finally(() => {
      state.isGenerating = false;
      toggleInputState(false);
      
      const textFocus = document.getElementById("chat-textarea-input");
      if (textFocus) textFocus.focus();
    });
}

// Activar o desactivar campos de chat durante la consulta
function toggleInputState(disabled) {
  const textarea = document.getElementById("chat-textarea-input");
  const btnSend = document.getElementById("btn-send-message");
  
  if (textarea) textarea.disabled = disabled;
  if (btnSend) btnSend.disabled = disabled;
}

// Genera un bloque de texto que resume la base de datos de estudiantes
function buildContextSummary() {
  if (state.students.length === 0) return "No hay estudiantes cargados en el sistema.";

  const activePeriod = getActivePeriod();
  const periodsConfig = getPeriodsConfig();
  const periodConfig = periodsConfig[activePeriod] || DEFAULT_PERIODS_CONFIG["Ciclo 1 - 2026"];
  const unit = getCurrentUnit(periodConfig);
  const statusStr = periodConfig.status === "completed" ? "Culminado" : "Activo";
  const simDateStr = periodConfig.simulationDate ? ` (Fecha de Simulación: ${periodConfig.simulationDate})` : "";

  const total = state.students.length;
  const highRisk = state.students.filter(s => s.riskLevel === "high");
  const mediumRisk = state.students.filter(s => s.riskLevel === "medium");
  const safe = state.students.filter(s => s.riskLevel === "low");
  const zeroAverageCount = state.students.filter(s => s.calculatedFinal === 0).length;

  // Agrupación por Carrera y sus niveles de riesgo
  const careerCount = {};
  const careerHigh = {};
  const careerMedium = {};
  const careerLow = {};
  
  state.students.forEach(s => {
    const code = s.carrera;
    careerCount[code] = (careerCount[code] || 0) + 1;
    if (s.riskLevel === "high") {
      careerHigh[code] = (careerHigh[code] || 0) + 1;
    } else if (s.riskLevel === "medium") {
      careerMedium[code] = (careerMedium[code] || 0) + 1;
    } else {
      careerLow[code] = (careerLow[code] || 0) + 1;
    }
  });

  // Asignaturas más críticas (reprobadas)
  const subjectFailures = {};
  state.students.forEach(s => {
    s.subjects.forEach(sub => {
      if (sub.calculatedFinal < 6.0) {
        subjectFailures[sub.materia] = (subjectFailures[sub.materia] || 0) + 1;
      }
    });
  });
  const topCriticalSubjects = Object.entries(subjectFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  let text = `CONTEXTO DEL SISTEMA (DATOS ACADÉMICOS REALES DEL CICLO ACTUAL):\n`;
  text += `- Ciclo Académico Seleccionado: ${activePeriod}\n`;
  text += `- Estado del Ciclo: ${statusStr}${simDateStr}\n`;
  text += `- Corte de Unidad Evaluativa: Unidad ${unit} (Las notas y promedios se calculan dividiendo entre ${unit} evaluaciones transcurridas de laboratorios y parciales)\n`;
  text += `- Total de alumnos únicos: ${total}\n`;
  text += `- Alumnos en Riesgo Alto (Reprobados / Promedio < 6.0): ${highRisk.length}\n`;
  text += `- Alumnos en Riesgo Medio (Alerta CUM / Promedio 6.0-6.9): ${mediumRisk.length}\n`;
  text += `- Alumnos en Riesgo Bajo / Sin Alerta (Aprobados Seguros / Promedio >= 7.0): ${safe.length}\n`;
  text += `- Alumnos con promedio general de 0.0 (inactivos o sin notas): ${zeroAverageCount}\n\n`;

  text += `RESUMEN DETALLADO POR CARRERA:\n`;
  for (let code in careerCount) {
    const name = CAREER_NAMES[code] || code;
    const tot = careerCount[code];
    const hi = careerHigh[code] || 0;
    const med = careerMedium[code] || 0;
    const lo = careerLow[code] || 0;
    text += `- Carrera ${name}: ${tot} alumnos (Riesgo Alto: ${hi}, Riesgo Medio: ${med}, Riesgo Bajo: ${lo})\n`;
  }

  text += `\nASIGNATURAS CON MÁS ALUMNOS REPROBADOS:\n`;
  if (topCriticalSubjects.length === 0) {
    text += `- Ninguna asignatura presenta alumnos reprobados.\n`;
  } else {
    topCriticalSubjects.forEach(([materia, reprobados]) => {
      text += `- Asignatura "${materia}": ${reprobados} alumnos reprobados.\n`;
    });
  }

  // Generar lista de estudiantes detallada en formato compacto
  // Si superamos los 600 alumnos, priorizamos los 600 con mayor score de riesgo para evitar saturar el prompt.
  const maxDetailed = 600;
  const sorted = [...state.students].sort((a, b) => b.riskScore - a.riskScore);
  
  text += `\nLISTADO DETALLADO DE ESTUDIANTES (Formato: Carnet|NombreCompleto|CarreraCod|PromedioCUM|NivelRiesgo|ScoreRiesgo|Asignaturas(Materia:NotaFinal:Docente;...)):\n`;
  
  sorted.forEach((s, idx) => {
    const includeSubjects = idx < maxDetailed;
    const fullName = `${s.apellidos}, ${s.nombres}`.replace(/\|/g, " ");
    const career = s.carrera;
    const cum = s.calculatedFinal.toFixed(2);
    const risk = s.riskLevel;
    const score = s.riskScore.toFixed(0);
    
    let subjectsStr = "";
    if (includeSubjects) {
      subjectsStr = s.subjects
        .map(sub => `${sub.materia}:${sub.calculatedFinal.toFixed(1)}:${sub.docente}`)
        .join(";");
    } else {
      subjectsStr = "(Detalle de materias omitido para optimizar espacio)";
    }
    
    text += `${s.carnet}|${fullName}|${career}|${cum}|${risk}|${score}|${subjectsStr}\n`;
  });

  text += `\nREGLAMENTO INSTITUCIONAL APLICADO:\n`;
  text += `- Promedio de laboratorios (40% de peso) y exámenes parciales (60% de peso).\n`;
  text += `- Nota mínima aprobatoria de materia: 6.0.\n`;
  text += `- Meta CUM de egreso recomendada: 7.0.\n`;

  return text;
}

// Llamar al endpoint del proveedor de IA correspondiente
function callAIProvider(userQuestion, systemContext) {
  const provider = state.apiProvider;
  
  if (provider === "gemini") {
    return callGemini(userQuestion, systemContext);
  } else if (provider === "openai") {
    return callOpenAI(userQuestion, systemContext);
  } else if (provider === "claude") {
    return callClaude(userQuestion, systemContext);
  }
  
  return Promise.reject(new Error("Proveedor no configurado correctamente."));
}

function getAISystemPrompt(context) {
  const currentLang = localStorage.getItem("atenas_language") || "es";
  if (currentLang === "en") {
    return `You are the Integrated AI Assistant of "Atenas Risk", an institutional academic analysis tool. Below are the actual academic data of the students for the current cycle. Use them to answer questions from teachers or coordinators analytically and proactively.\n\n${context}\n\nRESTRICTIONS:\n1. If they ask for names or averages, look them up in the provided list.\n2. If the information does not exist, say so honestly.\n3. Always respond in English in a structured manner with bullet points in markdown format.`;
  } else {
    return `Eres el Asistente IA Integrado de "Atenas Risk", una herramienta de análisis académico institucional. A continuación se te presentan los datos académicos reales de los estudiantes del ciclo actual. Úsalos para responder a las preguntas de los docentes o coordinadores de forma analítica y proactiva.\n\n${context}\n\nRESTRICCIONES:\n1. Si te preguntan por nombres o promedios, búscalos en el listado proveído.\n2. Si la información no existe, dilo con honestidad.\n3. Responde siempre en español de forma estructurada y con viñetas en formato markdown.`;
  }
}

// Integración Directa con la API de Google Gemini (gemini-2.5-flash)
function callGemini(question, context) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`;
  
  const historyParts = [];
  
  // Agregar el contexto como instrucción del sistema al inicio
  historyParts.push({
    text: getAISystemPrompt(context)
  });

  // Agregar el historial corto de la sesión
  state.messages.slice(-6, -1).forEach(m => {
    historyParts.push({
      text: `${m.role === 'user' ? 'Pregunta' : 'Respuesta'}: ${m.content}`
    });
  });

  // Agregar la pregunta actual
  historyParts.push({
    text: `Pregunta actual: ${question}`
  });

  const requestBody = {
    contents: [
      {
        parts: historyParts
      }
    ]
  };

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => {
        throw new Error(err.error?.message || `Error del servidor HTTP ${res.status}`);
      });
    }
    return res.json();
  })
  .then(data => {
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error("No se recibió una respuesta válida de Google Gemini.");
    }
    return textResponse;
  });
}

// Integración Directa con la API de OpenAI (gpt-4o-mini)
function callOpenAI(question, context) {
  const url = "https://api.openai.com/v1/chat/completions";
  
  const systemMessage = {
    role: "system",
    content: getAISystemPrompt(context)
  };

  const requestMessages = [systemMessage];

  // Agregar historial
  state.messages.slice(-6).forEach(m => {
    requestMessages.push({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content
    });
  });

  // Agregar mensaje actual si no está ya
  if (requestMessages[requestMessages.length - 1].content !== question) {
    requestMessages.push({
      role: "user",
      content: question
    });
  }

  const requestBody = {
    model: "gpt-4o-mini",
    messages: requestMessages,
    temperature: 0.7
  };

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${state.apiKey}`
    },
    body: JSON.stringify(requestBody)
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => {
        throw new Error(err.error?.message || `Error del servidor HTTP ${res.status}`);
      });
    }
    return res.json();
  })
  .then(data => {
    const textResponse = data.choices?.[0]?.message?.content;
    if (!textResponse) {
      throw new Error("No se recibió una respuesta válida de OpenAI.");
    }
    return textResponse;
  });
}

// Integración con Anthropic Claude (claude-3-5-sonnet-20241022)
// NOTA: Esta llamada puede fallar por políticas de CORS en navegadores estáticos puros
function callClaude(question, context) {
  const url = "https://api.anthropic.com/v1/messages";

  const requestMessages = [];
  state.messages.slice(-6).forEach(m => {
    requestMessages.push({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content
    });
  });

  if (requestMessages.length === 0 || requestMessages[requestMessages.length - 1].content !== question) {
    requestMessages.push({
      role: "user",
      content: question
    });
  }

  const requestBody = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1524,
    system: getAISystemPrompt(context),
    messages: requestMessages
  };

  return fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": state.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(requestBody)
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => {
        throw new Error(err.error?.message || `Error del servidor HTTP ${res.status}`);
      });
    }
    return res.json();
  })
  .then(data => {
    const textResponse = data.content?.[0]?.text;
    if (!textResponse) {
      throw new Error("No se recibió una respuesta válida de Anthropic Claude.");
    }
    return textResponse;
  });
}

// CONTROL DE TEMA CLARO / OSCURO
function setupThemeToggle() {
  const btnTheme = document.getElementById("theme-toggle");
  if (btnTheme) {
    btnTheme.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
      document.documentElement.classList.toggle("light-theme");
      const isLight = document.body.classList.contains("light-theme");
      localStorage.setItem("atenas_theme", isLight ? "light" : "dark");
      updateThemeIcon();
    });
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const iconEl = document.getElementById("theme-toggle-icon");
  if (!iconEl) return;
  const isLight = document.body.classList.contains("light-theme");
  iconEl.setAttribute("data-lucide", isLight ? "moon" : "sun");
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.addEventListener("languagechange", () => {
  refreshLayout();
  resetChatHistory();
});

